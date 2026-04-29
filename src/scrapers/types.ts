import { Page } from 'playwright'

export interface VenueSlot {
  courtName: string
  startsAt: Date
  endsAt: Date
  isAvailable: boolean
  priceCzk?: number
}

export interface ScraperConfig {
  bookingUrl: string
  horizonDays?: number
  [key: string]: any
}

export interface VenueScraper {
  venueSlug: string
  scrape(config: ScraperConfig): Promise<VenueSlot[]>
}
