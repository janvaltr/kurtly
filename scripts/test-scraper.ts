import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { runScraper } from '../src/scrapers/runner'

async function test() {
  console.log('--- TEST SCRAPERU FIT4ALL ---')
  try {
    await runScraper('fit4all')
    console.log('--- TEST DOKONČEN ---')
  } catch (err) {
    console.error('CHYBA:', err)
  }
}

test()
