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

          const cells = table.querySelectorAll('tbody td')
          cells.forEach((cell, idx) => {
            // Každá td buňka může obsahovat jeden nebo více slotů (div.court-cell)
            const courtDivs = cell.querySelectorAll('div.court-cell')
            if (courtDivs.length === 0) return

            // Zjistíme index kurtu (sloupce). První td v řádku je čas, tak musíme vědět, kde jsme.
            // Ale jednodušší je vzít to z data-court-number nebo parent struktury.
            // V Fit4All má každý div data-court-number.
            
            courtDivs.forEach(div => {
              const timeVal = parseFloat(div.getAttribute('data-time') || '0')
              const hour = Math.floor(timeVal)
              const minute = (timeVal % 1) === 0.5 ? '30' : '00'
              const timeStr = `${hour}:${minute}`
              
              const isAvailable = div.classList.contains('court-cell-free')
              const courtName = div.getAttribute('data-name') || 'Kurt'

              result.push({
                courtName,
                timeStr,
                isAvailable,
                durationMin: 30
              })
            })
          })
          return result
        })

        for (const s of daySlots) {
          // Vytvoříme ISO string s brněnským offsetem (+02:00 v dubnu)
          // Tím zajistíme, že i na Vercelu (UTC) se čas uloží správně.
          const hour = s.timeStr.split(':')[0].padStart(2, '0')
          const minute = s.timeStr.split(':')[1]
          const isoString = `${dateStr}T${hour}:${minute}:00+02:00`
          
          const startsAt = new Date(isoString)
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
