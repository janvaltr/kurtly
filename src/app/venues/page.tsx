import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format, addDays, isSameDay } from 'date-fns'
import { cs } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import SyncButton from './SyncButton'

const TIMEZONE = 'Europe/Prague'

export default async function VenuesPage() {
  const supabase = await createClient()

  const { data: venues } = await supabase
    .from('venues')
    .select('*')
    .eq('is_active', true)
    .order('name')

  const now = new Date()
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(now, i))

  const { data: allSlots } = await supabase
    .from('slots')
    .select('*, courts(name)')
    .gte('starts_at', now.toISOString())
    .lte('starts_at', addDays(now, 7).toISOString())
    .eq('is_available', true)
    .order('starts_at')

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="mx-auto w-full max-w-6xl px-8 py-12 space-y-16">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-5xl font-black text-text italic tracking-tighter leading-none">PRŮZKUMNÍK HAL</h1>
            <p className="mt-4 text-lg text-muted max-w-2xl">Aktuální přehled volných kurtů v Brně bez ohledu na tvoji skupinu.</p>
          </div>
          <SyncButton />
        </header>

        <div className="space-y-24">
          {venues?.map((venue) => {
            const venueSlots = allSlots?.filter(s => s.venue_id === venue.id) || []
            
            return (
              <section key={venue.id} className="space-y-10">
                <div className="flex items-end justify-between border-b-4 border-primary/20 pb-4">
                  <h2 className="font-display text-3xl font-black text-text uppercase tracking-tight">{venue.name}</h2>
                  <a 
                    href={venue.booking_url || '#'} 
                    target="_blank" 
                    className="group flex items-center space-x-2 text-sm font-bold uppercase tracking-widest text-primary hover:text-text transition-colors"
                  >
                    <span>Oficiální rezervace</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                </div>

                <div className="grid gap-8 md:grid-cols-7">
                  {next7Days.map((day) => {
                    const daySlots = venueSlots.filter(s => isSameDay(new Date(s.starts_at), day))
                    
                    return (
                      <div key={day.toISOString()} className="space-y-4">
                        <div className="border-b-2 border-border pb-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted">
                            {format(day, 'eeee', { locale: cs })}
                          </p>
                          <p className="font-display text-2xl font-black text-text leading-tight">
                            {format(day, 'd. M.')}
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          {daySlots.length > 0 ? (() => {
                            const timeGroups = daySlots.reduce((acc, slot) => {
                              const time = formatInTimeZone(new Date(slot.starts_at), TIMEZONE, 'HH:mm')
                              if (!acc[time]) acc[time] = []
                              acc[time].push(slot)
                              return acc
                            }, {} as Record<string, typeof daySlots>)
                            
                            const uniqueTimes = Object.keys(timeGroups).sort()
                            const displayTimes = uniqueTimes.slice(0, 10)
                            
                            return (
                              <>
                                {displayTimes.map(time => {
                                  const count = timeGroups[time].length
                                  return (
                                    <div 
                                      key={time} 
                                      className="group relative rounded-xl bg-surface p-3 border-2 border-border hover:border-primary hover:bg-white hover:shadow-xl hover:shadow-primary/10 transition-all cursor-default"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-display text-lg font-black">{time}</span>
                                        <span className={`whitespace-nowrap text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                                          count > 1 ? 'bg-primary/10 text-primary' : 'bg-muted/10 text-muted'
                                        }`}>
                                          {count} {count > 1 ? (count < 5 ? 'KURTY' : 'KURTŮ') : 'KURT'}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                                {uniqueTimes.length > 10 && (
                                  <p className="text-center text-xs font-bold text-muted pt-2">+{uniqueTimes.length - 10} dalších</p>
                                )}
                              </>
                            )
                          })() : (
                            <div className="py-12 text-center text-xs font-bold text-muted/30 uppercase tracking-widest bg-surface/50 rounded-xl border-2 border-dashed border-border/50">
                              Obsazeno
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
