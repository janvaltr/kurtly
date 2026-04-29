import { BaseScraper } from './base'

// Zde budeme importovat konkrétní implementace
// import { BrnoVodaScraper } from './implementations/brno-voda'

export const ScraperRegistry: Record<string, new () => BaseScraper> = {
  // 'brno-voda': BrnoVodaScraper,
}
