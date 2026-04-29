import { VenueScraper, VenueSlot } from '../types'
import { getSharedBrowser } from '../utils/playwright'

export const fit4allScraper: VenueScraper = {
  venueSlug: 'fit4all',

  async scrape(config) {
    const browser = await getSharedBrowser()
    const page = await browser.newPage()

    await page.setExtraHTTPHeaders({ 'Accept-Language': 'cs-CZ,cs;q=0.9' })

    const slots: VenueSlot[] = []
    const horizonDays = config.horizonDays ?? 7 // Pro testování stačí 7 dní
    const activityId = config.activityId ?? 6   // 6 je badminton

    for (let i = 0; i < horizonDays; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      console.log(`[fit4all] Scraping datum: ${dateStr}`)
      
      try {
        await page.goto(
          `https://www.fit4all.cz/cs/online-rezervace?date=${dateStr}&activity=${activityId}`,
          { waitUntil: 'networkidle', timeout: 30000 }
        )

        // Čekáme na tabulku, kterou plní AJAX
        await page.waitForSelector('table.reservations-table', { timeout: 10000 })

        const daySlots = await page.evaluate(() => {
          const result: any[] = []
          const table = document.querySelector('table.reservations-table')
          if (!table) return result

          const headerCells = Array.from(table.querySelectorAll('thead th'))
            .slice(1)
            .map(th => th.textContent?.trim() || 'Kurt')

          let lastTimeLabel = ''

          const rows = table.querySelectorAll('tbody tr')
          rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td')
            if (cells.length === 0) return

            let timeStr = cells[0]?.textContent?.trim() || ''
            
            // Pokud je label prázdný (u 30min slotů bývá label jen u první půlhodiny), 
            // odvodíme čas z předchozího nebo z pozice. 
            // U Fit4All je v prvním sloupci label např. "7:00" a pod ním je prázdno (pro 7:30).
            if (!timeStr && lastTimeLabel) {
              const [h, m] = lastTimeLabel.split(':').map(Number)
              timeStr = `${h}:${m === 0 ? '30' : (h + 1) + ':00'}`
            } else if (timeStr) {
              lastTimeLabel = timeStr
            }

            if (!timeStr) return

            cells.forEach((cell, idx) => {
              if (idx === 0) return // Sloupec s časem
              
              // VOLNÝ slot obsahuje interaktivní prvek (div nebo a)
              const isAvailable = !!cell.querySelector('div, a')
              
              result.push({
                courtName: headerCells[idx - 1] || `Kurt ${idx}`,
                timeStr: timeStr,
                isAvailable,
                durationMin: 30
              })
            })
          })
          return result
        })

        for (const s of daySlots) {
          const [h, m] = s.timeStr.split(':').map(Number)
          const startsAt = new Date(date)
          startsAt.setHours(h, m, 0, 0)
          
          const endsAt = new Date(startsAt.getTime() + s.durationMin * 60 * 1000)

          if (s.isAvailable) {
            slots.push({
              courtName: s.courtName,
              startsAt,
              endsAt,
              isAvailable: true
            })
          }
        }
      } catch (err) {
        console.error(`[fit4all] Chyba pro datum ${dateStr}:`, err)
      }

      // Malá pauza mezi dny
      await page.waitForTimeout(500 + Math.random() * 500)
    }

    await page.close()
    return slots
  }
}
