# Kurtly

> Koordinace skupinové rezervace badmintonových kurtů — automaticky.

Kurtly řeší jeden konkrétní problém: skupinka lidí chce hrát badminton, ale koordinace „kdy můžete, kde hrajeme, je tam volno?" probíhá chaoticky přes WhatsApp.

Kurtly to automatizuje:
1. Každý člen skupiny nastaví svoji dostupnost (jednou, průběžně aktualizuje).
2. Appka na pozadí scrapuje dostupnost kurtů ve vybraných halách.
3. Jakmile se shoduje slot (všichni jsou dostupní + kurt je volný + hala je preferovaná), přijde okamžitá push notifikace a email: **„Teď! Hala X má volno v 18:00, všichni můžete — jděte rezervovat."**

**Scope V1:** Badmintonové haly v Brně  
**Scope V2+:** Squash, tenis, padel; další města

---

## Tech stack

### Frontend
| Technologie | Verze | Důvod |
|---|---|---|
| **Next.js** | 14+ (App Router) | Full-stack v jednom repozitáři, SSR pro SEO, Server Actions pro formuláře |
| **TypeScript** | 5+ | Typová bezpečnost zejména pro scrapovaná data a DB schéma |
| **Tailwind CSS** | 3+ | Rychlý vývoj, konzistentní design systém |
| **shadcn/ui** | latest | Přístupné komponenty bez vendor lock-in (kód je přímo v projektu) |
| **Lucide React** | latest | Ikony |
| **date-fns** | 3+ | Práce s časy a opakující se dostupností |
| **@dnd-kit/core** | latest | Drag & drop řazení halí |

### Backend & databáze
| Technologie | Důvod |
|---|---|
| **Supabase** | PostgreSQL + Auth + Realtime + Edge Functions v jednom. Free tier zvládne MVP. |
| **Drizzle ORM** | Type-safe ORM; generuje typy přímo z DB schématu |
| **Supabase Realtime** | Push aktualizací do UI při nových slotech — bez pollingu |

### Scraping
| Technologie | Důvod |
|---|---|
| **Playwright** | Jediná volba — všechny brněnské haly renderují dostupnost JavaScriptem. Statický HTTP request vrátí prázdný div. Viz `scrapers.md`. |
| **p-limit** | Throttling — max 3 haly paralelně, prevence blokace |

### Notifikace
| Technologie | Důvod |
|---|---|
| **web-push** | Web Push API — push notifikace do prohlížeče / PWA |
| **Resend** | Transakční emaily, free tier 3 000/měsíc |

### Deployment
| Služba | Použití |
|---|---|
| **Vercel** | Frontend + Cron Jobs pro scraper |
| **Supabase** | DB + Auth + Edge Functions |
| **GitHub** | Verzování, auto-deploy přes Vercel integration |

---

## Struktura projektu

```
kurtly/
├── app/                        # Next.js App Router — viz design.md
├── components/
│   ├── ui/                     # shadcn/ui komponenty
│   ├── availability/
│   │   ├── WeeklyGrid.tsx      # Doodle-like editor dostupnosti
│   │   └── MemberOverlay.tsx   # Overlay dostupnosti ostatních členů
│   ├── venues/
│   │   ├── VenueCard.tsx
│   │   └── VenueRanker.tsx     # Drag & drop řazení
│   ├── matches/
│   │   └── MatchCard.tsx       # Hlavní CTA karta „Teď je volno"
│   └── notifications/
│       └── PushSubscriber.tsx  # Registrace Web Push
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client (cookies)
│   │   └── admin.ts            # Service role (scraper, notifikace)
│   ├── db/
│   │   ├── schema.ts           # Drizzle ORM schéma
│   │   └── queries/            # Typované query funkce
│   ├── matching/
│   │   ├── engine.ts           # Matching algoritmus — viz architecture.md
│   │   └── availability.ts     # Vyhodnocení dostupnosti uživatele
│   └── notifications/
│       ├── push.ts             # web-push odesílání
│       └── email.tsx           # React Email šablony
├── scrapers/                   # Viz scrapers.md
│   ├── types.ts
│   ├── runner.ts
│   ├── utils/
│   └── venues/
├── supabase/
│   ├── migrations/             # SQL migrace — viz database.md
│   └── functions/
│       ├── scraper-runner/     # Edge Function — cron scraping
│       └── notification-engine/
├── public/
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service Worker
├── emails/
│   └── MatchNotification.tsx
└── types/
    └── database.types.ts       # Auto-generované ze Supabase
```

---

## Quick start

```bash
# 1. Vytvoř projekt
npx create-next-app@latest kurtly --typescript --tailwind --app
cd kurtly

# 2. Závislosti
npm install @supabase/supabase-js @supabase/ssr drizzle-orm
npm install playwright p-limit date-fns
npm install web-push resend
npm install @dnd-kit/core @dnd-kit/sortable
npm install -D drizzle-kit @types/web-push

# 3. shadcn/ui
npx shadcn@latest init

# 4. Supabase local dev
npx supabase init
npx supabase start
npx supabase db push          # aplikuj migrace z database.md

# 5. Vygeneruj VAPID klíče pro push notifikace
npx web-push generate-vapid-keys

# 6. Dev server
npm run dev
```

Po každé změně DB schématu:
```bash
npx supabase gen types typescript --local > types/database.types.ts
```

---

## Roadmap

### MVP — „Funguje pro jednu skupinu"
- [ ] Supabase projekt + migrace + RLS (`database.md`)
- [ ] Auth — magic link přihlášení
- [ ] Profil uživatele
- [ ] Vytvoření skupiny + invite link (8-znakový kód)
- [ ] Availability editor — týdenní grid, opakující se bloky
- [ ] Venue preferences — drag & drop řazení halí
- [ ] Seed venues — 3 brněnské haly ručně do DB (bez scrapingu)
- [ ] Základní matching engine (bez notifikací)
- [ ] Dashboard skupiny — zobrazení matchů
- [ ] Deploy Vercel + Supabase

### V1 — „Scrapuje a notifikuje"
- [ ] Playwright scraper — Fit4All jako první (`scrapers.md`)
- [ ] Scraper pro Halu Sprint (memberzone.cz)
- [ ] Vercel Cron Job — spouští scraping každých 10 minut
- [ ] Matching engine napojený na nové sloty
- [ ] Push notifikace (PWA + Service Worker)
- [ ] Email notifikace (Resend)
- [ ] Realtime update v dashboard (Supabase Realtime)

### V2 — „Škáluje a roste"
- [ ] Další haly (Club Classic po ověření; e-rezervace.cz po souhlasu)
- [ ] Jednorázové výjimky v dostupnosti
- [ ] Potvrzení účasti na matchi
- [ ] Squash, tenis, padel
- [ ] Další města
- [ ] Scraper health dashboard
- [ ] Google OAuth

---

## Dokumentace

| Soubor | Obsah |
|---|---|
| `README.md` | Tento soubor — přehled, stack, struktura, roadmap |
| `database.md` | DB schéma, RLS políčky, seed data |
| `architecture.md` | Systémový diagram, matching engine, notifikace, Edge Functions, env vars |
| `design.md` | Design systém, screens, app router, PWA manifest |
| `scrapers.md` | Scraping architektura, typy, šablona, analýza halí s kódem |

---

## Vibe-coding tipy

1. **Začni od DB** (`database.md`) — nejdřív migrace, pak typy, pak UI. Všechno se odvíjí od schématu.
2. **Scraper vyvíjej izolovaně** — piš `scraper.test.ts`, spusť lokálně a ověř výstup před napojením na cron.
3. **Matching engine testuj na seed datech** — `seed.sql` se 3 uživateli, skupinou a mock sloty. Nezávislé na scraperu.
4. **RLS testuj jako nepřihlášený uživatel** — je snadné zapomenout policy a nechtěně vystavit data.
5. **Vercel Cron místo Supabase Edge Function pro scraper** — Playwright v Deno runtime (Edge Functions) má kompatibilitní problémy. Vercel Cron Job jako Next.js API route je spolehlivější.
