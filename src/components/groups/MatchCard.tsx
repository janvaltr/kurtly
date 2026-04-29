'use client'

import React from 'react'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'

export default function MatchCard({ match }: { match: any }) {
  const slot = match.slots
  const venue = slot.venues
  const startsAt = new Date(slot.starts_at)

  return (
    <div className="rounded-3xl border-2 border-border bg-white p-8 space-y-6 hover:border-primary transition-all shadow-sm hover:shadow-2xl hover:shadow-primary/10">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-2 py-1 rounded inline-block">
            {format(startsAt, 'eeee d. MMMM', { locale: cs })}
          </p>
          <h3 className="text-5xl font-display font-black mt-4 text-text italic tracking-tighter">
            {format(startsAt, 'HH:mm')}
          </h3>
          <p className="text-muted text-sm font-bold uppercase tracking-widest mt-1">
            Končí v {format(new Date(slot.ends_at), 'HH:mm')}
          </p>
        </div>
        {slot.price_czk && (
          <div className="bg-surface px-4 py-2 rounded-xl text-sm font-black text-primary border-2 border-primary/20">
            {Math.round(slot.price_czk)} Kč
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-6">
        <div className="flex items-center space-x-2">
          <span className="font-display text-xl font-black text-text uppercase tracking-tight">{venue.name}</span>
        </div>
        <div className="text-xs font-bold text-muted uppercase tracking-widest">
          {venue.address}
        </div>
      </div>

      <div className="pt-4">
        <a
          href={venue.booking_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-text text-bg font-display font-black text-lg py-5 rounded-2xl hover:bg-primary hover:text-bg transition-all shadow-xl shadow-text/5 uppercase tracking-tight italic"
        >
          Rezervovat kurty →
        </a>
      </div>
    </div>
  )
}
