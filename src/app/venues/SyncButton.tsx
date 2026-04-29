'use client'

import { useTransition } from 'react'
import { syncAllVenues } from './actions'

export default function SyncButton() {
  const [isPending, startTransition] = useTransition()

  const handleSync = () => {
    startTransition(async () => {
      try {
        await syncAllVenues()
        alert('Synchronizace dokončena!')
      } catch (error) {
        alert('Chyba při synchronizaci: ' + (error instanceof Error ? error.message : 'Neznámá chyba'))
      }
    })
  }

  return (
    <button
      onClick={handleSync}
      disabled={isPending}
      className="flex items-center space-x-2 rounded-xl bg-text px-6 py-3 font-display text-sm font-bold text-bg transition-all hover:bg-text/90 disabled:opacity-50 shadow-lg shadow-text/10 active:scale-95"
    >
      <span className={isPending ? 'animate-spin' : ''}>
        {isPending ? '⏳' : '🔄'}
      </span>
      <span>{isPending ? 'Synchronizuji...' : 'Aktualizovat data'}</span>
    </button>
  )
}
