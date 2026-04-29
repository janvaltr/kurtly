# Kurtly — Scraping systém

Architektura scraperů, typové rozhraní, sdílené utility, šablona pro nové haly, runner s registrem a podrobná analýza konkrétních brněnských halí.

---

## Proč Playwright (a nic jiného)

Z průzkumu 5 brněnských booking systémů vyplynulo: **všechny renderují dostupnost kurtů JavaScriptem** po načtení stránky. Statický HTTP request (fetch, curl, axios) vrátí prázdnou tabulku nebo prázdné buňky. Playwright spustí headless Chromium, počká na dokončení AJAX requestů a teprve pak parsuje DOM.

Cheerio a přímé HTTP requesty z původního návrhu vypadly po analýze konkrétních systémů.

---

## Adresářová struktura

```
src/
└── scrapers/
    ├── types.ts              # Společné typy a interfaces
    ├── runner.ts             # Orchestrator + SCRAPER_REGISTRY
    ├── utils/
    │   ├── playwright.ts     # Sdílená Playwright browser instance (singleton)
    │   └── normalize.ts      # Normalizace dat + upsert do DB
    └── venues/
        ├── fit4all.ts        # ✅ P1: Fit4All Nový Lískovec (Drupal + AJAX sloty)
        ├── memberzone.ts     # ✅ P2: Generický adaptér pro celou memberzone.cz platformu
        │                     #        pokryje Halu Sprint + jakékoliv další memberzone sportoviště
        ├── clubclassic.ts    # ⚠️ P3: Club Classic Brno (custom PHP, vyžaduje UA spoofing)
        └── _template.ts      # Šablona pro přidávání nových halí
```

**Haly mimo V1 scope** (e-rezervace.cz — Sport Kuklenská, Badminton Jehnice): `robots.txt` explicitně blokuje všechny crawlery (`Disallow: /`). Soubory nevytvářet, dokud nebude potvrzen souhlas provozovatelů nebo API přístup od platformy e-rezervace.cz.

---

## Typy (types.ts)

```typescript
// scrapers/types.ts

export interface VenueSlot {
  courtName:  string;
  startsAt:   Date;
  endsAt:     Date;
  isAvailable: boolean;
  priceCzk?:  number;
}

export interface VenueScraper {
  venueSlug: string;
  scrape(config: ScraperConfig): Promise<VenueSlot[]>;
}

export interface ScraperConfig {
  bookingUrl:            string;
  horizonDays?:          number;   // default: 14
  userAgent?:            string;
  waitBetweenRequestsMs?: number;  // default: 750
  [key: string]: unknown;          // venue-specifické parametry
}
```

---

## Sdílené utility

### Playwright singleton (utils/playwright.ts)

Jeden browser pro celý scraper run — nespouštět nový Chromium pro každou halu nebo každý den.

```typescript
// scrapers/utils/playwright.ts
import { Browser, chromium } from 'playwright';

let browser: Browser | null = null;

export async function getSharedBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function closeSharedBrowser(): Promise<void> {
  await browser?.close();
  browser = null;
}
```

### Upsert slotů do DB (utils/normalize.ts)

```typescript
// scrapers/utils/normalize.ts
import { db } from '@/lib/db';
import { slots, courts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { VenueSlot } from '../types';

export async function upsertSlots(venueId: string, rawSlots: VenueSlot[]) {
  for (const slot of rawSlots) {
    const court = await db.query.courts.findFirst({
      where: and(eq(courts.venueId, venueId), eq(courts.name, slot.courtName))
    });
    if (!court) {
      console.warn(`[normalize] Neznámý kurt: ${slot.courtName} pro venue ${venueId}`);
      continue;
    }
    await db.insert(slots)
      .values({
        venueId,
        courtId:     court.id,
        startsAt:    slot.startsAt,
        endsAt:      slot.endsAt,
        isAvailable: slot.isAvailable,
        priceCzk:    slot.priceCzk,
        scrapedAt:   new Date(),
      })
      .onConflictDoUpdate({
        target: [slots.courtId, slots.startsAt],
        set:    { isAvailable: slot.isAvailable, scrapedAt: new Date() },
      });
  }
}
```

---

## Runner a SCRAPER_REGISTRY (runner.ts)

`scraper_key` v DB tabulce `venues` mapuje na konkrétní implementaci. Přidání nové haly = nový záznam v DB + nový soubor v `venues/` + registrace zde.

```typescript
// scrapers/runner.ts
import pLimit from 'p-limit';
import { db } from '@/lib/db';
import { venues } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { upsertSlots } from './utils/normalize';
import { closeSharedBrowser } from './utils/playwright';
import { checkMatchesForVenue } from '@/lib/matching/engine';
import { fit4allScraper }    from './venues/fit4all';
import { memberzoneScraper } from './venues/memberzone';
import { clubclassicScraper } from './venues/clubclassic';
import { VenueScraper } from './types';

const SCRAPER_REGISTRY: Record<string, VenueScraper> = {
  'fit4all':     fit4allScraper,
  'memberzone':  memberzoneScraper,  // pokryje všechny memberzone.cz haly
  'clubclassic': clubclassicScraper,
};

export function getScraperByKey(key: string): VenueScraper {
  const scraper = SCRAPER_REGISTRY[key];
  if (!scraper) throw new Error(`Scraper '${key}' nenalezen v registru`);
  return scraper;
}

export async function runAllScrapers() {
  const activeVenues = await db.select()
    .from(venues)
    .where(eq(venues.isActive, true));

  const limit = pLimit(3); // max 3 scrapery paralelně

  await Promise.allSettled(
    activeVenues.map(venue =>
      limit(async () => {
        try {
          console.log(`[runner] Spouštím scraper: ${venue.slug}`);
          const scraper = getScraperByKey(venue.scraperKey);
          const slots   = await scraper.scrape(venue.scraperConfig as any);
          await upsertSlots(venue.id, slots);
          await checkMatchesForVenue(venue.id);
          console.log(`[runner] ✓ ${venue.slug}: ${slots.length} slotů`);
        } catch (err) {
          console.error(`[runner] ✗ ${venue.slug}:`, err);
        }
      })
    )
  );

  await closeSharedBrowser();
}
```

---

## Šablona pro nové scrapery (_template.ts)

```typescript
// scrapers/venues/_template.ts
// Kopíruj tento soubor jako základ pro každou novou halu.
// Povinné kroky po zkopírování:
//   1. Změň venueSlug na slug z DB
//   2. Uprav URL a selektory (viz krok DEBUG níže)
//   3. Registruj v SCRAPER_REGISTRY v runner.ts
//   4. Přidej záznam venues + courts do DB / seed.sql

import { VenueScraper, VenueSlot } from '../types';
import { getSharedBrowser } from '../utils/playwright';

export const templateScraper: VenueScraper = {
  venueSlug: 'venue-slug', // musí odpovídat venues.slug v DB

  async scrape(config) {
    const browser = await getSharedBrowser();
    const page    = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'User-Agent': config.userAgent ??
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept-Language': 'cs-CZ,cs;q=0.9',
    });

    const slots: VenueSlot[] = [];
    const horizonDays = config.horizonDays ?? 14;

    for (let i = 0; i < horizonDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      // Způsob navigace závisí na booking systému:
      // A) URL param:       `${config.bookingUrl}?date=${dateStr}`
      // B) Kliknutí:        await page.click(`.calendar-day[data-date="${dateStr}"]`)
      await page.goto(`${config.bookingUrl}?date=${dateStr}`);

      // waitForLoadState('networkidle') čeká až JS dokončí AJAX.
      // Pokud je pomalé, nahraď za waitForSelector na konkrétní slot element.
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      // ── DEBUG ─────────────────────────────────────────────────────────────
      // Při prvním vývoji odkomentuj, spusť a zkopíruj HTML do editoru.
      // Najdi správné CSS selektory pro sloty, kurty a stavy (volno/obsazeno).
      // const html = await page.content();
      // console.log(`[${this.venueSlug}] HTML snippet:`, html.substring(0, 5000));
      // ─────────────────────────────────────────────────────────────────────

      // Parsování — přesné selektory NUTNO ověřit v DevTools!
      // page.evaluate() běží v kontextu prohlížeče — Date nelze serializovat,
      // proto vracíme stringy a konvertujeme venku.
      const daySlots = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('TODO_SLOT_SELECTOR')).map(el => ({
          courtName:   el.getAttribute('data-court') ?? 'Kurt 1',
          timeStr:     el.getAttribute('data-time')  ?? '00:00',
          durationMin: parseInt(el.getAttribute('data-duration') ?? '60'),
          isAvailable: el.classList.contains('TODO_AVAILABLE_CLASS'),
          priceCzk:    parseFloat(el.getAttribute('data-price') ?? '0') || undefined,
        }));
      });

      // Konverze časů na Date (POZOR: CET = UTC+1, CEST = UTC+2)
      for (const s of daySlots) {
        const startsAt = new Date(`${dateStr}T${s.timeStr}:00+02:00`);
        const endsAt   = new Date(startsAt.getTime() + s.durationMin * 60_000);
        slots.push({ courtName: s.courtName, startsAt, endsAt,
                     isAvailable: s.isAvailable, priceCzk: s.priceCzk });
      }

      const delay = config.waitBetweenRequestsMs ?? 750;
      await page.waitForTimeout(delay + Math.random() * 500);
    }

    await page.close(); // zavřít stránku, ne celý browser (je sdílený!)
    return slots;
  }
};
```

---

## Analýza konkrétních halí

### ✅ PRIORITA 1 — Fit4All Nový Lískovec

**URL:** `https://www.fit4all.cz/cs/online-rezervace?date=YYYY-MM-DD&activity=6`  
**Platforma:** Drupal (PHP) s vlastním booking modulem  
**robots.txt:** Žádná blokace (stránka je Google-indexovaná, Drupal výchozí robots.txt)  
**Obtížnost:** střední

**Technický nález:**  
Stránka se renderuje server-side (Drupal). Tabulka kurtů (`Badminton KURT 1–4`) je v HTML, ale **buňky jsou prázdné** — dostupnost doplňuje JavaScript přes AJAX po načtení. Nutný Playwright.  
URL vzor je vzorový: stačí měnit datum v query stringu.

```typescript
// scrapers/venues/fit4all.ts
import { VenueScraper, VenueSlot } from '../types';
import { getSharedBrowser } from '../utils/playwright';

export const fit4allScraper: VenueScraper = {
  venueSlug: 'fit4all',

  async scrape(config) {
    const browser = await getSharedBrowser();
    const page    = await browser.newPage();

    await page.setExtraHTTPHeaders({ 'Accept-Language': 'cs-CZ,cs;q=0.9' });

    const slots: VenueSlot[] = [];
    const horizonDays = config.horizonDays ?? 14;
    const activityId  = config.activityId  ?? 6;

    for (let i = 0; i < horizonDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      await page.goto(
        `https://www.fit4all.cz/cs/online-rezervace?date=${dateStr}&activity=${activityId}`
      );

      // Čekat na naplnění buněk JS — ověřit správný selektor v DevTools!
      // Hledej třídu buněk po načtení AJAX (pravděpodobně .booking-slot nebo td.free/td.taken)
      await page.waitForSelector('table td', { timeout: 10000 });

      // ── DEBUG: při prvním spuštění odkomentuj ──
      // const html = await page.content();
      // console.log('[fit4all] HTML:', html.substring(0, 8000));

      const daySlots = await page.evaluate((d) => {
        const result: Array<{
          courtName: string; timeStr: string;
          isAvailable: boolean; priceCzk?: number;
        }> = [];

        // Hlavička tabulky obsahuje názvy kurtů (Kurt 1, Kurt 2...)
        const headerCells = Array.from(
          document.querySelectorAll('table thead th')
        ).slice(1).map(th => th.textContent?.trim() ?? 'Kurt');

        document.querySelectorAll('table tbody tr').forEach(row => {
          const cells = row.querySelectorAll('td');
          const timeStr = cells[0]?.textContent?.trim() ?? '00:00'; // např. "7:00"
          const paddedTime = timeStr.length === 4 ? `0${timeStr}` : timeStr; // "7:00" → "07:00"

          cells.forEach((cell, idx) => {
            if (idx === 0) return; // přeskočit sloupec s časem
            // TODO: ověřit skutečné třídy v DevTools
            const isAvailable = !cell.classList.contains('obsazeno') &&
                                 !cell.classList.contains('reserved');
            result.push({
              courtName:   headerCells[idx - 1] ?? `Kurt ${idx}`,
              timeStr:     paddedTime,
              isAvailable,
            });
          });
        });

        return result;
      }, dateStr);

      for (const s of daySlots) {
        const startsAt = new Date(`${dateStr}T${s.timeStr}:00+02:00`);
        const endsAt   = new Date(startsAt.getTime() + 60 * 60_000); // 1h sloty
        slots.push({ courtName: s.courtName, startsAt, endsAt, isAvailable: s.isAvailable });
      }

      await page.waitForTimeout(600 + Math.random() * 600);
    }

    await page.close();
    return slots;
  }
};
```

> **⚠️ Povinné před použitím:** Po `page.goto()` odkomentuj DEBUG console.log a ověř skutečné CSS třídy pro obsazené (`obsazeno`? `reserved`? `booked`?) a volné sloty. Tabulka má 4 kurty × ~16 časových řádků = ~64 slotů/den.

---

### ✅ PRIORITA 2 — Hala Sprint (memberzone.cz)

**URL:** `https://memberzone.cz/sprint_tenis/Sportoviste.aspx?ID_Sportoviste=3&NAZEV=Badminton+hala`  
**Platforma:** ASP.NET Web Forms (.aspx) — SaaS platforma **Member Pro / EMA** (LUXART s.r.o.)  
**robots.txt:** 503 při průzkumu (nejasný stav) — stránka je Google-indexována  
**Obtížnost:** střední-vysoká

**Technický nález:**  
ASP.NET Web Forms = server-side rendering + **ViewState** (velký skrytý formulářový stav `__VIEWSTATE`). ViewState ztěžuje klasické HTTP scrapování, Playwright ViewState ignoruje — naviguje jako reálný browser.

**Klíčová výhoda:** Jeden `memberzone` scraper pokryje **všechny haly na celé platformě memberzone.cz**. Stačí změnit `ID_Sportoviste` v `scraper_config` pro každou halu v DB.

```typescript
// scrapers/venues/memberzone.ts
import { VenueScraper, VenueSlot } from '../types';
import { getSharedBrowser } from '../utils/playwright';

export const memberzoneScraper: VenueScraper = {
  venueSlug: 'memberzone-generic',

  async scrape(config) {
    const browser = await getSharedBrowser();
    const page    = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'User-Agent': config.userAgent ??
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept-Language': 'cs-CZ,cs;q=0.9',
    });

    const slots: VenueSlot[] = [];
    const horizonDays = config.horizonDays ?? 14;
    const baseUrl = `${config.bookingUrl}?ID_Sportoviste=${config.courtId}&NAZEV=Badminton+hala`;

    for (let i = 0; i < horizonDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`; // CZ formát

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      // ASP.NET Web Forms může vyžadovat navigaci přes formulářové postback
      // Zkus URL param pro datum (záleží na implementaci):
      // await page.goto(`${baseUrl}&Datum=${encodeURIComponent(dateStr)}`);

      // ── DEBUG ──
      // const html = await page.content();
      // console.log('[memberzone] HTML:', html.substring(0, 8000));

      const daySlots = await page.evaluate((d) => {
        // TODO: ověřit DOM strukturu v DevTools pro memberzone.cz rozvrh
        // Typický .aspx rozvrh má GridView tabulku nebo proprietární HTML
        const rows = document.querySelectorAll('TODO_ROW_SELECTOR');
        return Array.from(rows).map(row => ({
          courtName:   row.querySelector('TODO_COURT_SELECTOR')?.textContent?.trim() ?? 'Kurt',
          timeStr:     row.querySelector('TODO_TIME_SELECTOR')?.textContent?.trim() ?? '00:00',
          durationMin: 60,
          isAvailable: row.classList.contains('TODO_FREE_CLASS'),
        }));
      }, dateStr);

      for (const s of daySlots) {
        const [h, m] = s.timeStr.split(':').map(Number);
        const startsAt = new Date(date);
        startsAt.setHours(h, m, 0, 0);
        const endsAt = new Date(startsAt.getTime() + s.durationMin * 60_000);
        slots.push({ courtName: s.courtName, startsAt, endsAt, isAvailable: s.isAvailable });
      }

      await page.waitForTimeout(800 + Math.random() * 700);
    }

    await page.close();
    return slots;
  }
};
```

> **⚠️ Před implementací:**
> 1. Ručně ověřit `https://memberzone.cz/robots.txt` (bylo 503 při průzkumu)
> 2. Otevřít stránku v prohlížeči, zkontrolovat je-li rozvrh viditelný bez přihlášení
> 3. Odkomentovat DEBUG log a ověřit DOM selektory
> 4. Zjistit jak funguje navigace na konkrétní datum (URL param nebo postback?)

---

### ⚠️ PRIORITA 3 — Club Classic Brno

**URL:** `https://rezervace.clubclassic.cz/?page=day_overview&id=22`  
**Platforma:** Vlastní PHP aplikace (vyvinuta agenturou SOVA NET)  
**robots.txt:** 403 — nelze zjistit pravidla  
**Obtížnost:** vysoká

**Technický nález:**  
Server vrací HTTP 403 na přímé requesty (User-Agent filtrování). Playwright s realistickým User-Agentem by to měl obejít. Alternativa: kontaktovat Club Classic přímo.

```typescript
// scrapers/venues/clubclassic.ts
// Poznámka: nastavit venues.is_active = false dokud není ověřen přístup

import { VenueScraper, VenueSlot } from '../types';
import { getSharedBrowser } from '../utils/playwright';

export const clubclassicScraper: VenueScraper = {
  venueSlug: 'club-classic',

  async scrape(config) {
    const browser = await getSharedBrowser();
    const page    = await browser.newPage();

    // Nutný realistický UA — server filtruje boty
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
      'Referer':         'https://www.clubclassic.cz/',
    });

    const slots: VenueSlot[] = [];
    const horizonDays = config.horizonDays ?? 7; // kratší horizont — vyšší riziko blokace

    for (let i = 0; i < horizonDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // URL vzor: ?page=day_overview&id=22&date=YYYY-MM-DD (ověřit!)
      await page.goto(
        `https://rezervace.clubclassic.cz/?page=day_overview&id=${config.venueId ?? 22}&date=${dateStr}`
      );

      try {
        await page.waitForLoadState('networkidle', { timeout: 12000 });
      } catch {
        console.warn(`[clubclassic] Timeout pro ${dateStr}, přeskakuji`);
        continue;
      }

      // ── DEBUG ──
      // const status = page.url(); // zkontroluj není-li redirect na 403 stránku
      // const html   = await page.content();
      // console.log('[clubclassic] URL:', status, '\nHTML:', html.substring(0, 5000));

      // TODO: ověřit DOM strukturu po úspěšném načtení
      const daySlots = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('TODO_SLOT_SELECTOR')).map(el => ({
          courtName:   el.getAttribute('TODO') ?? 'Kurt',
          timeStr:     el.getAttribute('TODO') ?? '00:00',
          durationMin: 60,
          isAvailable: el.classList.contains('TODO_FREE'),
        }));
      });

      for (const s of daySlots) {
        const [h, m] = s.timeStr.split(':').map(Number);
        const startsAt = new Date(date);
        startsAt.setHours(h, m, 0, 0);
        const endsAt = new Date(startsAt.getTime() + s.durationMin * 60_000);
        slots.push({ courtName: s.courtName, startsAt, endsAt, isAvailable: s.isAvailable });
      }

      // Delší delay — prevence blokace
      const delay = config.waitBetweenRequestsMs ?? 2000;
      await page.waitForTimeout(delay + Math.random() * 1000);
    }

    await page.close();
    return slots;
  }
};
```

---

### ❌ BLOKOVÁNO — Sport Kuklenská & Badminton Jehnice (e-rezervace.cz)

**URLs:**
- `sportkuklenska.e-rezervace.cz/Branch/pages/Schedule.faces`
- `badminton-jehnice.e-rezervace.cz/Branch/pages/Schedule.faces`

**Platforma:** JavaServer Faces (JSF) — Java EE. Přípona `.faces` = JSF FacesServlet.  
**robots.txt:** `Disallow: /` — VŠICHNI roboti zakázáni.

Scrapování technicky možné přes Playwright, ale **porušuje podmínky platformy** a zakládá právní riziko.

**Postup:**
1. Kontaktovat provozovatele hal přímo (email/telefon)
2. Kontaktovat platformu e-rezervace.cz s dotazem na API přístup pro agregátory
3. Tyto haly vést v DB s `is_active = false`

Soubory v `venues/` pro tyto haly **nevytvářet**.

---

## Přehled — doporučené pořadí implementace

| # | Hala | Platforma | Scraper key | robots.txt | V1 MVP |
|---|---|---|---|---|---|
| 1 | **Fit4All** | Drupal | `fit4all` | ✅ OK | ✅ ANO |
| 2 | **Hala Sprint** | memberzone.cz (ASP.NET) | `memberzone` | ❓ Ověřit | ✅ ANO (po ověření) |
| 3 | **Club Classic** | Custom PHP | `clubclassic` | ❓ Neznámý | ⚠️ Zvažit |
| 4 | Sport Kuklenská | e-rezervace.cz (JSF) | — | ❌ Zakázáno | ❌ NE |
| 5 | Badminton Jehnice | e-rezervace.cz (JSF) | — | ❌ Zakázáno | ❌ NE |

---

## Jak přidat novou halu

1. Prozkoumej booking systém haly v prohlížeči (DevTools → Network tab)
2. Zkopíruj `_template.ts` jako `venues/nova-hala.ts`
3. Doplň správné selektory (viz DEBUG sekce v šabloně)
4. Registruj v `SCRAPER_REGISTRY` v `runner.ts`
5. Přidej záznam do `venues` tabulky v DB s `scraper_key` + `scraper_config`
6. Přidej kurty do `courts` tabulky
7. Otestuj izolovaně: `npx ts-node scrapers/venues/nova-hala.test.ts`
