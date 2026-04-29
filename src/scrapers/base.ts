import { chromium, Browser, Page } from 'playwright'

export interface ScrapedSlot {
  court_name: string
  starts_at: string
  ends_at: string
  price_czk?: number
}

export abstract class BaseScraper {
  abstract slug: string
  abstract name: string

  /**
   * Hlavní metoda, kterou musí každý scraper implementovat.
   * Vrací seznam nalezených volných slotů.
   */
  abstract scrape(): Promise<ScrapedSlot[]>

  /**
   * Pomocná metoda pro inicializaci prohlížeče.
   */
  protected async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    })
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
      })
      const page = await context.newPage()
      return await fn(page)
    } finally {
      await browser.close()
    }
  }
}
