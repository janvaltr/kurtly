'use server'

import { runAllScrapers } from '@/scrapers/runner'
import { revalidatePath } from 'next/cache'

export async function syncAllVenues() {
  try {
    console.log('[sync] Ruční synchronizace spuštěna...')
    await runAllScrapers()
    revalidatePath('/venues')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error: any) {
    console.error('[sync] Chyba při ruční synchronizaci:', error)
    return { success: false, error: error.message }
  }
}
