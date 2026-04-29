import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { VenueScraper, VenueSlot } from './types'
import { fit4allScraper } from './venues/fit4all'
import { closeSharedBrowser } from './utils/playwright'
import { processNewSlotsForCity } from '@/lib/engine/matching'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SCRAPER_REGISTRY: Record<string, VenueScraper> = {
  'fit4all': fit4allScraper,
}

export async function runScraper(venueSlug: string) {
  const scraper = SCRAPER_REGISTRY[venueSlug]
  if (!scraper) throw new Error(`Scraper pro ${venueSlug} není registrován.`)

  const { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('slug', venueSlug)
    .single()

  if (!venue) throw new Error(`Hala ${venueSlug} nebyla nalezena v DB.`)

  console.log(`[runner] Spouštím ${venueSlug}...`)
  const rawSlots = await scraper.scrape(venue.scraper_config as any || {})

  // 1. Smazat staré budoucí sloty pro tuto halu
  await supabase
    .from('slots')
    .delete()
    .eq('venue_id', venue.id)
    .gt('starts_at', new Date().toISOString())

  // 2. Načíst kurty pro tuto halu pro mapování jmen na ID
  const { data: courts } = await supabase
    .from('courts')
    .select('id, name')
    .eq('venue_id', venue.id)

  const courtMap = new Map(courts?.map(c => [c.name, c.id]))

  // 3. Vložit nové volné sloty
  if (rawSlots.length > 0) {
    const toInsert = rawSlots
      .filter(s => s.isAvailable)
      .map(s => {
        const courtId = courtMap.get(s.courtName)
        if (!courtId) {
           console.warn(`[runner] Kurt "${s.courtName}" nenalezen v DB pro halu ${venue.slug}`)
        }
        return {
          venue_id: venue.id,
          court_id: courtId || null,
          starts_at: s.startsAt.toISOString(),
          ends_at: s.endsAt.toISOString(),
          is_available: true,
          price_czk: s.priceCzk
        }
      })

    await supabase.from('slots').insert(toInsert as any)
  }

  console.log(`[runner] ${venueSlug} dokončeno. Nalezeno ${rawSlots.length} slotů.`)

  // 3. Spustit Matching Engine
  await processNewSlotsForCity(venue.city)
}

export async function runAllScrapers() {
  const { data: venues } = await supabase
    .from('venues')
    .select('slug')
    .eq('is_active', true)

  if (!venues) return

  for (const venue of venues) {
    try {
      await runScraper(venue.slug)
    } catch (err) {
      console.error(`[runner] Chyba u ${venue.slug}:`, err)
    }
  }

  await closeSharedBrowser()
}
