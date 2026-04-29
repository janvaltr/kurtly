import { chromium, Browser } from 'playwright'

let browser: Browser | null = null

export async function getSharedBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    })
  }
  return browser
}

export async function closeSharedBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}
