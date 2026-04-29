import { runAllScrapers } from '@/scrapers/runner'
import { NextResponse } from 'next/server'

/**
 * Vercel Cron Job: Spouští se periodicky (např. každých 15 minut).
 * 1. Spustí všechny registrované scrapery pro aktivní haly.
 * 2. Scrapery uloží volné sloty do DB.
 * 3. Runner automaticky spustí Matching Engine pro každé město.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel Pro limit je 300s, Hobby 10s (bacha na to)

export async function GET(request: Request) {
  // Ověření tajného klíče (nastavte CRON_SECRET v environmentálních proměnných)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    console.log('[cron] Spouštím hromadný scraping a matching...')
    await runAllScrapers()
    return NextResponse.json({ success: true, message: 'Scraping and matching completed.' })
  } catch (error: any) {
    console.error('[cron] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
