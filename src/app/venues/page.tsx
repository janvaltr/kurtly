import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format, addDays, isSameDay } from 'date-fns'
import { cs } from 'date-fns/locale'
import SyncButton from './SyncButton'

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
    .select('*')
    .gte('starts_at', now.toISOString())
    .lte('starts_at', addDays(now, 7).toISOString())
    .eq('is_available', true)
    .order('starts_at')

  return (
    <div className="flex min-h-screen flex-col bg-bg p-8 text-text">
      <div className="mx-auto w-full max-w-6xl space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-muted hover:text-text">← Dashboard</Link>
            <h1 className="mt-2 font-display text-4xl font-bold text-primary italic tracking-tight">PRŮZKUMNÍK HAL</h1>
            <p className="text-muted">Aktuální přehled volných kurtů v Brně bez ohledu na tvoji skupinu.</p>
          </div>
          <SyncButton />
        </header>

        <div className="space-y-16">
          {venues?.map((venue) => {
            const venueSlots = allSlots?.filter(s => s.venue_id === venue.id) || []
            
            return (
              <section key={venue.id} className="space-y-6">
                <div className="flex items-baseline justify-between border-b border-border pb-4">
                  <h2 className="font-display text-2xl font-bold text-text">{venue.name}</h2>
                  <a 
                    href={venue.booking_url || '#'} 
                    target="_blank" 
                    className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                  >
                    Oficiální web →
                  </a>
                </div>

                <div className="grid gap-6 md:grid-cols-7">
                  {next7Days.map((day) => {
                    const daySlots = venueSlots.filter(s => isSameDay(new Date(s.starts_at), day))
                    
                    return (
                      <div key={day.toISOString()} className="space-y-3">
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-tighter text-muted">
                            {format(day, 'eeee', { locale: cs })}
                          </p>
                          <p className="font-display text-lg font-bold">
                            {format(day, 'd. M.')}
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          {daySlots.length > 0 ? (
                            daySlots.slice(0, 8).map((slot) => (
                              <div 
                                key={slot.id} 
                                className="rounded bg-surface-2 p-2 text-center text-xs font-mono font-medium border border-border/50 hover:border-primary/30 transition-colors"
                              >
                                {format(new Date(slot.starts_at), 'HH:mm')}
                              </div>
                            ))
                          ) : (
                            <div className="py-8 text-center text-[10px] text-muted/30 italic">
                              Žádné volno
                            </div>
                          )}
                          {daySlots.length > 8 && (
                            <p className="text-center text-[10px] text-muted">+{daySlots.length - 8} dalších</p>
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
