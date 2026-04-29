# Kurtly — Architektura backendu

Systémový diagram, matching engine, notifikace, Supabase Edge Functions a environment variables.

---

## Systémový diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        UŽIVATEL                             │
│              Next.js App (Vercel)                           │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ Landing  │  │  Dashboard   │  │  Availability      │   │
│  │  page    │  │  skupiny     │  │  editor (Doodle)   │   │
│  └──────────┘  └──────────────┘  └────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ Supabase JS Client
                           │ (Auth + Realtime + DB)
┌──────────────────────────▼──────────────────────────────────┐
│                      SUPABASE                               │
│                                                             │
│  ┌─────────────────┐   ┌──────────────────────────────┐   │
│  │   PostgreSQL    │   │     Realtime subscriptions   │   │
│  │   (Drizzle ORM) │   │  (slot changes → UI update)  │   │
│  └────────┬────────┘   └──────────────────────────────┘   │
│           │                                                  │
│  ┌────────▼────────────────────────────────────────────┐   │
│  │           Edge Functions (Deno)                     │   │
│  │  ┌──────────────────┐   ┌─────────────────────┐   │   │
│  │  │  scraper-runner  │   │  notification-engine │   │   │
│  │  │  (cron: */10 *)  │   │  (DB trigger → fn)  │   │   │
│  │  └────────┬─────────┘   └─────────┬───────────┘   │   │
│  └───────────┼───────────────────────┼───────────────┘   │
└──────────────┼───────────────────────┼────────────────────┘
               │                       │
    ┌──────────▼──────────┐   ┌───────▼──────────────┐
    │   VENUE SCRAPERS    │   │   NOTIFICATION       │
    │   (Playwright)      │   │   SERVICES           │
    │   fit4all.ts        │   │  ┌───────────────┐  │
    │   memberzone.ts     │   │  │ web-push      │  │
    │   clubclassic.ts    │   │  │ (PWA push)    │  │
    └─────────────────────┘   │  ├───────────────┤  │
                               │  │ Resend        │  │
                               │  │ (email)       │  │
                               │  └───────────────┘  │
                               └──────────────────────┘
```

> **Poznámka k schedulingu:** Playwright v Deno (Edge Functions) má kompatibilitní problémy. Preferovaná varianta pro scraper je **Vercel Cron Job** (Next.js API route `/api/scraper/route.ts`) s `CRON_SECRET` autorizací. Edge Function zůstává jako fallback.

---

## Matching engine

Matching engine běží pokaždé, když `upsertSlots()` zapíše nový nebo změněný slot do DB.

### Algoritmus

```
pro každý nový AVAILABLE slot S:
  pro každou skupinu G, která má halu S.venue v preferencích:

    1. Zjisti dostupné členy:
       - Pro každého člena skupiny G:
         - isUserAvailable(userId, S.starts_at, S.ends_at) == true?
       - Počet dostupných >= G.min_players?

    2. Pokud ano — vypočítej skóre preference:
       score = průměr(venue_preferences.rank pro S.venue
                      od každého dostupného člena)
       (nižší rank = více preferovaná = lepší skóre)

    3. Ulož nebo aktualizuj matches(group_id, slot_id, score)
       - INSERT ON CONFLICT DO UPDATE

    4. Pokud match.notified_at IS NULL:
       → spusť notification-engine(match)
       → nastav match.notified_at = now()
```

### Vyhodnocení dostupnosti uživatele

```typescript
// lib/matching/availability.ts

export async function isUserAvailable(
  userId: string,
  groupId: string,
  startsAt: Date,
  endsAt: Date
): Promise<boolean> {
  const dayOfWeek = startsAt.getDay() === 0 ? 6 : startsAt.getDay() - 1; // 0=Po

  // 1. Načti recurring dostupnosti pro daný den v týdnu
  const recurring = await db.select()
    .from(userAvailability)
    .where(and(
      eq(userAvailability.userId, userId),
      eq(userAvailability.groupId, groupId),
      eq(userAvailability.type, 'recurring'),
      eq(userAvailability.dayOfWeek, dayOfWeek),
      eq(userAvailability.isException, false),
    ));

  // 2. Načti oneoff dostupnosti překrývající interval
  const oneoff = await db.select()
    .from(userAvailability)
    .where(and(
      eq(userAvailability.userId, userId),
      eq(userAvailability.groupId, groupId),
      eq(userAvailability.type, 'oneoff'),
      eq(userAvailability.isException, false),
      lte(userAvailability.startsAt, startsAt),
      gte(userAvailability.endsAt, endsAt),
    ));

  // 3. Načti výjimky (recurring slot zrušen pro konkrétní datum)
  const exceptions = await db.select()
    .from(userAvailability)
    .where(and(
      eq(userAvailability.userId, userId),
      eq(userAvailability.groupId, groupId),
      eq(userAvailability.isException, true),
      lte(userAvailability.startsAt, startsAt),
      gte(userAvailability.endsAt, endsAt),
    ));

  if (exceptions.length > 0) return false;

  // Recurring: zkontroluj, zda time_from–time_to pokrývá celý slot
  const slotTimeFrom = `${startsAt.getHours().toString().padStart(2,'0')}:${startsAt.getMinutes().toString().padStart(2,'0')}`;
  const slotTimeTo   = `${endsAt.getHours().toString().padStart(2,'0')}:${endsAt.getMinutes().toString().padStart(2,'0')}`;

  const coveredByRecurring = recurring.some(r =>
    r.timeFrom! <= slotTimeFrom && r.timeTo! >= slotTimeTo
  );

  return coveredByRecurring || oneoff.length > 0;
}
```

### upsertSlots a spuštění matchingu

```typescript
// lib/matching/engine.ts

export async function upsertSlots(venueId: string, rawSlots: VenueSlot[]) {
  for (const slot of rawSlots) {
    // Najdi court_id podle jména kurtu
    const court = await db.query.courts.findFirst({
      where: and(eq(courts.venueId, venueId), eq(courts.name, slot.courtName))
    });

    const [upserted] = await db.insert(slots)
      .values({
        venueId,
        courtId:     court?.id,
        startsAt:    slot.startsAt,
        endsAt:      slot.endsAt,
        isAvailable: slot.isAvailable,
        priceCzk:    slot.priceCzk,
        scrapedAt:   new Date(),
      })
      .onConflictDoUpdate({
        target: [slots.courtId, slots.startsAt],
        set: { isAvailable: slot.isAvailable, scrapedAt: new Date() },
      })
      .returning();

    // Matching jen pro nově dostupné sloty
    if (upserted.isAvailable) {
      await checkMatchesForSlot(upserted);
    }
  }
}

async function checkMatchesForSlot(slot: typeof slots.$inferSelect) {
  // Načti skupiny, které mají tuto halu v preferencích
  const interestedGroups = await db.select({ groupId: venuePreferences.groupId })
    .from(venuePreferences)
    .where(eq(venuePreferences.venueId, slot.venueId))
    .groupBy(venuePreferences.groupId);

  for (const { groupId } of interestedGroups) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
    const members = await db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, groupId) });

    // Zjisti kteří členové jsou dostupní
    const availableMembers = await Promise.all(
      members.map(async m => ({
        ...m,
        available: await isUserAvailable(m.userId, groupId, slot.startsAt, slot.endsAt)
      }))
    );
    const available = availableMembers.filter(m => m.available);

    if (available.length < (group?.minPlayers ?? 2)) continue;

    // Vypočítej skóre preference
    const ranks = await Promise.all(
      available.map(m =>
        db.query.venuePreferences.findFirst({
          where: and(
            eq(venuePreferences.groupId, groupId),
            eq(venuePreferences.userId, m.userId),
            eq(venuePreferences.venueId, slot.venueId),
          )
        })
      )
    );
    const score = ranks.reduce((sum, r) => sum + (r?.rank ?? 99), 0) / available.length;

    // Ulož match
    const [match] = await db.insert(matches)
      .values({ groupId, slotId: slot.id, score })
      .onConflictDoUpdate({
        target: [matches.groupId, matches.slotId],
        set: { score },
      })
      .returning();

    // Pošli notifikace pokud ještě neodešly
    if (!match.notifiedAt) {
      await sendMatchNotifications(match, available.map(m => m.userId));
    }
  }
}
```

---

## Notifikace

### Web Push (PWA)

```typescript
// components/notifications/PushSubscriber.tsx
// Registrace push subscription v prohlížeči — spustit po přihlášení

export async function subscribeToPush() {
  const registration = await navigator.serviceWorker.register('/sw.js');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  // Uložit do profiles.push_subscription
  await supabase
    .from('profiles')
    .update({ push_subscription: subscription.toJSON() })
    .eq('id', userId);
}
```

```typescript
// lib/notifications/push.ts
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:hello@kurtly.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushToUser(
  subscription: PushSubscription,
  matchData: { venueName: string; startsAt: Date; groupId: string; matchId: string }
) {
  const payload = JSON.stringify({
    title: '🏸 Teď je volno!',
    body:  `${matchData.venueName} — ${formatTime(matchData.startsAt)}, všichni můžete`,
    url:   `/groups/${matchData.groupId}?match=${matchData.matchId}`,
    icon:  '/icon-192.png',
    badge: '/badge-72.png',
  });
  await webpush.sendNotification(subscription as any, payload);
}
```

```javascript
// public/sw.js — Service Worker
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icon-192.png',
      badge:   '/badge-72.png',
      data:    { url: data.url },
      actions: [
        { action: 'reserve', title: '🎯 Rezervovat' },
        { action: 'dismiss', title: 'Zavřít' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'reserve' || !event.action) {
    clients.openWindow(event.notification.data.url);
  }
});
```

### Email (Resend + React Email)

```typescript
// lib/notifications/email.tsx
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMatchEmail(
  recipients: string[],
  matchData: { venueName: string; startsAt: Date; bookingUrl: string }
) {
  await resend.emails.send({
    from:    'Kurtly <notifikace@kurtly.app>',
    to:      recipients,
    subject: `🏸 Volno v ${matchData.venueName} — ${formatDate(matchData.startsAt)}`,
    react:   <MatchNotificationEmail match={matchData} />,
  });
}
```

```tsx
// emails/MatchNotification.tsx (React Email šablona)
import { Html, Body, Container, Heading, Text, Button } from '@react-email/components';

export function MatchNotificationEmail({ match }: { match: MatchData }) {
  return (
    <Html>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#0F1117', color: '#F5F5F5' }}>
        <Container>
          <Heading>🏸 Teď je volno!</Heading>
          <Text>{match.venueName}</Text>
          <Text>{formatDateTime(match.startsAt)}</Text>
          <Button href={match.bookingUrl} style={{ backgroundColor: '#00C896' }}>
            Rezervovat →
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
```

### Odesílání notifikací po matchi

```typescript
// lib/notifications/index.ts
export async function sendMatchNotifications(
  match: typeof matches.$inferSelect,
  userIds: string[]
) {
  const profiles = await db.select()
    .from(profilesTable)
    .where(inArray(profilesTable.id, userIds));

  const slot = await db.query.slots.findFirst({ where: eq(slots.id, match.slotId) });
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, slot!.venueId) });

  for (const profile of profiles) {
    // Push
    if (profile.pushNotifications && profile.pushSubscription) {
      await sendPushToUser(profile.pushSubscription as any, {
        venueName: venue!.name,
        startsAt:  slot!.startsAt,
        groupId:   match.groupId,
        matchId:   match.id,
      });
      await logNotification(match.id, profile.id, 'push', 'sent');
    }

    // Email
    if (profile.emailNotifications) {
      const user = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (user.data.user?.email) {
        await sendMatchEmail([user.data.user.email], {
          venueName:  venue!.name,
          startsAt:   slot!.startsAt,
          bookingUrl: venue!.bookingUrl ?? '#',
        });
        await logNotification(match.id, profile.id, 'email', 'sent');
      }
    }
  }

  // Označ match jako notifikovaný
  await db.update(matches)
    .set({ notifiedAt: new Date() })
    .where(eq(matches.id, match.id));
}
```

---

## Vercel Cron Job (doporučená varianta pro scraper)

```typescript
// app/api/scraper/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runAllScrapers } from '@/scrapers/runner';

export async function POST(req: NextRequest) {
  // Autorizace — Vercel Cron posílá CRON_SECRET v Authorization headeru
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await runAllScrapers();
  return NextResponse.json({ ok: true });
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/scraper",
    "schedule": "*/10 * * * *"
  }]
}
```

## Supabase Edge Function (fallback)

```toml
# supabase/config.toml
[functions.scraper-runner]
verify_jwt = false

[functions.scraper-runner.cron]
schedule = "*/10 * * * *"
```

```typescript
// supabase/functions/scraper-runner/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';

serve(async () => {
  // Zavolá Next.js API route místo přímého spuštění scraperu
  // (Playwright není v Deno nativně podporován)
  const res = await fetch(`${Deno.env.get('APP_URL')}/api/scraper`, {
    method: 'POST',
    headers: { authorization: `Bearer ${Deno.env.get('CRON_SECRET')}` },
  });
  return new Response(await res.text(), { status: res.status });
});
```

---

## Supabase Realtime v dashboardu

```typescript
// Přihlásit se k real-time aktualizacím matchů pro skupinu
const channel = supabase
  .channel(`matches:group_${groupId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'matches',
    filter: `group_id=eq.${groupId}`,
  }, (payload) => {
    // Nový match — zobraz toast a aktualizuj feed
    toast.success('🏸 Nové volno! Koukni na dashboard.');
    refetchMatches();
  })
  .subscribe();

// Cleanup při unmount komponenty
return () => { supabase.removeChannel(channel); };
```

---

## Environment variables

```bash
# .env.local

# ── Supabase ──────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # veřejný klíč (safe pro client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # POUZE server-side! Nikdy do klienta.

# ── Web Push (VAPID) ──────────────────────
# Vygeneruj: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxx...        # veřejný (safe pro client)
VAPID_PRIVATE_KEY=xxxx...                   # POUZE server-side!

# ── Resend (email) ────────────────────────
RESEND_API_KEY=re_xxxx...

# ── App ───────────────────────────────────
NEXT_PUBLIC_APP_URL=https://kurtly.app
CRON_SECRET=xxxx...                         # náhodný string, auth pro /api/scraper
```
