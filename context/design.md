# Kurtly — Design systém & UI

Design systém, vizuální identita, popis všech obrazovek a struktura Next.js App Routeru.

---

## Vizuální identita

### Tón a osobnost
Sportovní, moderní, energický. Appka, která tlačí k akci — ne k přemýšlení. Primární UI akce (`Rezervovat →`) musí být vždy vizuálně dominantní. Žádné zbytečné dekorace.

### Barevná paleta

| Název | Hex | Použití |
|---|---|---|
| **Primary** | `#00C896` | CTA tlačítka, aktivní stavy, dostupné sloty, „go signal" |
| **Accent** | `#FF5733` | Urgentní notifikace, „teď!", badge s počtem nových matchů |
| **Background** | `#0F1117` | Hlavní pozadí (dark mode výchozí) |
| **Surface** | `#1C2030` | Karty, sidebary, elevated panels |
| **Surface 2** | `#252A3D` | Hover stavy, secondary cards |
| **Text primary** | `#F5F5F5` | Hlavní text |
| **Text muted** | `#8B8FA8` | Sekundární text, popisky |
| **Border** | `#2E3350` | Oddělovače, outline prvky |
| **Danger** | `#EF4444` | Chybové stavy, blokovaná sportoviště |
| **Warning** | `#F59E0B` | Upozornění (skoro obsazeno, čekat) |

### Typografie

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Sans:wght@400;500&display=swap');

:root {
  --font-display: 'Outfit', sans-serif;   /* headings, logo, CTA */
  --font-body:    'DM Sans', sans-serif;  /* body text, labels */

  --color-primary:    #00C896;
  --color-accent:     #FF5733;
  --color-bg:         #0F1117;
  --color-surface:    #1C2030;
  --color-surface-2:  #252A3D;
  --color-text:       #F5F5F5;
  --color-muted:      #8B8FA8;
  --color-border:     #2E3350;
}

body {
  font-family:      var(--font-body);
  background-color: var(--color-bg);
  color:            var(--color-text);
}

h1, h2, h3, .logo, .cta {
  font-family: var(--font-display);
}
```

### Dark mode jako výchozí
Kurtly je nativně dark. Light mode v V2 (pokud uživatelé žádají). shadcn/ui inicializovat s `--dark` variantou.

### Ikonografie
Lucide React — výchozí sada. Konzistentní tloušťka linek (1.5px stroke). Ikony ve velikostech 16, 20, 24px.

---

## Tailwind config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',   // nebo 'media' — defaultně zapni dark třídu na <html>
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:   '#00C896',
        accent:    '#FF5733',
        surface:   '#1C2030',
        'surface-2': '#252A3D',
        border:    '#2E3350',
        muted:     '#8B8FA8',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
      },
    },
  },
};

export default config;
```

---

## App Router — struktura stránek

```
app/
├── layout.tsx                    # Root layout: font, dark mode class, Supabase provider
├── page.tsx                      # Landing page (veřejná)
│
├── auth/
│   ├── login/page.tsx            # Přihlášení (magic link e-mail)
│   └── callback/page.tsx         # Supabase auth callback — přesměrování po loginu
│
├── dashboard/
│   └── page.tsx                  # Přehled skupin uživatele (po přihlášení)
│
├── groups/
│   ├── new/page.tsx              # Vytvoření skupiny
│   ├── join/[code]/page.tsx      # Vstup přes invite kód
│   └── [id]/
│       ├── page.tsx              # ★ Dashboard skupiny — hlavní obrazovka
│       ├── availability/
│       │   └── page.tsx          # Doodle-like editor dostupnosti
│       ├── venues/
│       │   └── page.tsx          # Výběr a řazení preferovaných halí
│       └── matches/
│           └── page.tsx          # Historie matchů skupiny
│
├── profile/
│   └── page.tsx                  # Nastavení profilu, push notifikace toggle
│
└── api/
    ├── scraper/route.ts          # POST — Vercel Cron Job trigger
    ├── push-subscribe/route.ts   # POST — uložení Web Push subscription
    └── webhooks/
        └── supabase/route.ts     # POST — Supabase DB webhook
```

---

## Obrazovky — podrobný popis

### Landing page (`/`)
- **Hero:** Logo Kurtly + tagline „Badminton bez WhatsApp koordinace." + CTA „Začít zdarma →"
- **How it works:** 3 kroky ikonami (Nastav dostupnost / Vyber haly / Dostaň notifikaci)
- **Features:** Krátký přehled funkcí
- **Footer:** Odkaz na přihlášení

### Login (`/auth/login`)
- Jedno pole: email address
- Tlačítko „Pošleme ti přihlašovací odkaz"
- Po odeslání: „Zkontroluj svůj email"
- Bez hesla — pouze magic link (Supabase Auth)

### Dashboard uživatele (`/dashboard`)
- Grid karet skupin uživatele
- Karta skupiny: název, sport, počet členů, počet nových matchů (badge)
- FAB tlačítko „+ Nová skupina"
- Tlačítko „Připojit se ke skupině" (zadání kódu)

### ★ Dashboard skupiny (`/groups/[id]`)
Hlavní obrazovka aplikace. Tři sekce:

**1. Matches feed (horní část — dominantní)**
- Karty `MatchCard` seřazené dle score (nejlepší match nahoře)
- Velká zelená karta: název haly, čas, datum, „všichni mohou" indikátor
- CTA tlačítko `Rezervovat →` (otevře booking URL haly v novém tabu)
- Pokud není žádný match: prázdný stav „Zatím žádné volno. Hlídáme za tebe. 🏸"

**2. Členové skupiny**
- Row avatarů s display_name
- Zelená tečka = dostupnost nastavena; šedá = nenastavena
- Tlačítko „Pozvat" → sdílí invite link (`/groups/join/[code]`)

**3. Quick stats (spodní — sekundární)**
- Kolik halí se sleduje | Kdy proběhl poslední scraping | Počet kurtů celkem

### Availability editor (`/groups/[id]/availability`)

```
Záložky: [Opakující se] [Výjimky]

Týdenní grid (Po–Ne × 6:00–23:00, 30min bloky):

        Po  Út  St  Čt  Pá  So  Ne
 6:00  [ ] [ ] [ ] [ ] [ ] [ ] [ ]
 6:30  [ ] [ ] [ ] [ ] [ ] [ ] [ ]
 7:00  [■] [■] [ ] [■] [■] [ ] [ ]   ← zelené = dostupný
 ...
22:30  [ ] [ ] [■] [ ] [ ] [■] [■]
23:00  [ ] [ ] [ ] [ ] [ ] [ ] [ ]
```

- **Interakce:** klik na buňku = toggle; tažení přes buňky = hromadný výběr
- **Overlay ostatních členů:** průhledné vrstvy v odlišných barvách (jen čtení)
- **Mobil:** vertikálně scrollovatelný grid, buňky dostatečně velké pro dotyk (min 44px výška)
- **Záložka „Výjimky":** jednorázové blokování (např. příští úterý nejsem)

```typescript
// components/availability/WeeklyGrid.tsx
// Props:
interface WeeklyGridProps {
  value: AvailabilityBlock[];          // vlastní dostupnost uživatele
  onChange: (blocks: AvailabilityBlock[]) => void;
  otherMembers?: MemberAvailability[]; // pro overlay (readonly)
}
```

### Venue preferences (`/groups/[id]/venues`)
- Nadpis „Seřaď haly podle preference"
- Drag & drop list (`@dnd-kit/sortable`)
- Každá karta: logo haly, název, adresa, sport, odkaz na web haly
- Toggle: zapnout/vypnout halu pro tuto skupinu
- Pořadí = rank (1 = nejvíce preferovaná)

```typescript
// components/venues/VenueRanker.tsx
// Používá @dnd-kit/core + @dnd-kit/sortable
// Po reorder zavolá: supabase.from('venue_preferences').upsert([...updatedRanks])
```

### Profil (`/profile`)
- Display name (editable)
- Avatar (Supabase Storage upload)
- Push notifikace: toggle + tlačítko „Otestovat notifikaci"
- Email notifikace: toggle
- Tlačítko „Odhlásit se"

---

## Klíčové komponenty

### MatchCard

```tsx
// components/matches/MatchCard.tsx
// Zobrazuje jeden match — nejdůležitější UI element celé appky

interface MatchCardProps {
  match: Match;
  venue: Venue;
  slot: Slot;
  availableMembers: Profile[];
}

// Vizuál:
// ┌──────────────────────────────────────────┐
// │ 🏸  Fit4All Nový Lískovec                 │
// │     Středa 14. 5. · 18:00–19:00          │
// │     ████ ████ ████ (avatary členů)        │
// │     [  Rezervovat →  ]   120 Kč / 1h     │
// └──────────────────────────────────────────┘
// Barva pozadí: var(--color-surface)
// Border-left: 4px solid var(--color-primary)
// CTA tlačítko: bg var(--color-primary), font Outfit
```

### PushSubscriber

```tsx
// components/notifications/PushSubscriber.tsx
// Zobrazí se po prvním přihlášení — žádost o povolení push notifikací

export function PushSubscriber() {
  const [status, setStatus] = useState<'idle'|'requesting'|'granted'|'denied'>('idle');

  const handleEnable = async () => {
    setStatus('requesting');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await subscribeToPush();
      setStatus('granted');
    } else {
      setStatus('denied');
    }
  };

  if (status === 'granted') return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="font-display text-sm">Zapni push notifikace a dozvíš se o volném kurtu okamžitě.</p>
      <button onClick={handleEnable} className="mt-2 bg-primary text-bg rounded px-4 py-2 text-sm font-display">
        Zapnout notifikace
      </button>
    </div>
  );
}
```

---

## PWA

```json
// public/manifest.json
{
  "name": "Kurtly",
  "short_name": "Kurtly",
  "description": "Badmintonové kurty bez koordinace přes WhatsApp",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#00C896",
  "background_color": "#0F1117",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

```tsx
// app/layout.tsx — registrace Service Workeru
'use client';
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

---

## Responsivita

- **Mobile-first** — primární use case: dostaneš notifikaci na mobilu, klikneš, rezervuješ
- Breakpoints (Tailwind výchozí): `sm: 640px`, `md: 768px`, `lg: 1024px`
- Availability grid: na `< sm` zobraz jen 3 dny (dnešek + 2); horizontální scroll pro zbytek
- MatchCard: full-width na mobilu, max 680px na desktopu
- Navigace: bottom nav na mobilu, sidebar na `lg+`
