'use client'

import React from 'react'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'

export default function MatchCard({ match }: { match: any }) {
  const slot = match.slots
  const venue = slot.venues
  const startsAt = new Date(slot.starts_at)

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4 hover:border-primary/50 transition-colors shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-widest">
            {format(startsAt, 'eeee d. MMMM', { locale: cs })}
          </p>
          <h3 className="text-2xl font-display font-bold mt-1 text-text">
            {format(startsAt, 'HH:mm')}
            <span className="text-muted font-normal mx-2 text-lg">–</span>
            {format(new Date(slot.ends_at), 'HH:mm')}
          </h3>
        </div>
        {slot.price_czk && (
          <div className="bg-surface-2 px-3 py-1 rounded-md text-xs font-mono font-bold text-primary border border-primary/20">
            {slot.price_czk} Kč
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-muted">Hala:</span>
          <span className="font-semibold text-text">{venue.name}</span>
        </div>
        <div className="text-xs text-muted">
          {venue.address}
        </div>
      </div>

      <div className="pt-4 flex space-x-3">
        <a
          href={venue.booking_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-grow text-center bg-primary text-bg font-display font-bold py-3 rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/10"
        >
          Rezervovat →
        </a>
      </div>
    </div>
  )
}
