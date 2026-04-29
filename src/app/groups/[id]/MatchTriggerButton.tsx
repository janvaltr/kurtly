'use client'

import { useTransition } from 'react'
import { triggerMatching } from './match-actions'

export default function MatchTriggerButton({ groupId }: { groupId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleTrigger = () => {
    startTransition(async () => {
      try {
        await triggerMatching(groupId)
        alert('Hledání zápasů dokončeno! Pokud systém našel shodu s volnými kurty, uvidíš je v seznamu.')
      } catch (error) {
        alert('Chyba při hledání zápasů: ' + (error instanceof Error ? error.message : 'Neznámá chyba'))
      }
    })
  }

  return (
    <button
      onClick={handleTrigger}
      disabled={isPending}
      className="flex items-center space-x-2 rounded-xl border-2 border-border bg-white px-4 py-2 text-sm font-bold hover:border-primary transition-all disabled:opacity-50"
    >
      <span>{isPending ? '⏳ Hledám...' : '🔍 Hledat zápasy'}</span>
    </button>
  )
}
