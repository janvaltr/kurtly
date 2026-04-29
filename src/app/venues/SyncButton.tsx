'use client'

import { useState } from 'react'
import { syncAllVenues } from './actions'

export default function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    if (!confirm('Tato operace spustí scrapery pro všechny haly a může trvat až minutu. Pokračovat?')) return
    
    setIsSyncing(true)
    const result = await syncAllVenues()
    setIsSyncing(false)

    if (result.success) {
      alert('Data byla úspěšně aktualizována!')
    } else {
      alert('Chyba při synchronizaci: ' + result.error)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`flex items-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
        isSyncing 
          ? 'bg-surface-2 text-muted cursor-not-allowed' 
          : 'bg-primary text-bg hover:bg-primary/90 shadow-lg shadow-primary/20'
      }`}
    >
      {isSyncing ? (
        <>
          <span className="animate-spin inline-block w-4 h-4 border-2 border-muted border-t-transparent rounded-full mr-2"></span>
          Synchronizuji...
        </>
      ) : (
        <>
          <span>🔄</span>
          <span>Aktualizovat data</span>
        </>
      )}
    </button>
  )
}
