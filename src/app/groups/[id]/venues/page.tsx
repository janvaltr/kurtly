import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import VenueSortableList from '@/components/venues/VenueSortableList'
import { saveVenuePreferences } from './actions'

export default async function VenuePreferencesPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Získáme info o skupině (hlavně město)
  const { data: group } = await supabase
    .from('groups')
    .select('city, name')
    .eq('id', id)
    .single()

  if (!group) redirect('/dashboard')

  // Získáme všechny dostupné haly v daném městě
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, address')
    .eq('city', group.city)
    .eq('is_active', true)

  // Získáme stávající preference uživatele
  const { data: preferences } = await supabase
    .from('venue_preferences')
    .select('venue_id, rank')
    .eq('group_id', id)
    .eq('user_id', user.id)
    .order('rank', { ascending: true })

  const preferredIds = preferences?.map(p => p.venue_id) || []
  
  // Seřadíme haly tak, aby ty preferované byly nahoře ve správném pořadí
  const sortedVenues = [
    ...(venues?.filter(v => preferredIds.includes(v.id)).sort((a, b) => preferredIds.indexOf(a.id) - preferredIds.indexOf(b.id)) || []),
    ...(venues?.filter(v => !preferredIds.includes(v.id)) || [])
  ]

  // Předpřipravíme akci pro klientskou komponentu
  const handleSave = async (ids: string[]) => {
    'use server'
    await saveVenuePreferences(id, ids)
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg p-8 text-text">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="flex flex-col space-y-2">
          <Link href={`/groups/${id}`} className="text-sm text-muted hover:text-text">← Zpět do skupiny</Link>
          <h1 className="font-display text-3xl font-bold text-primary">Preference hal</h1>
          <p className="text-muted leading-relaxed">
            Seřaď si haly v <strong>{group.city}</strong> podle toho, kde hraješ nejraději. 
            Kurtly bude hledat volné sloty v tomto pořadí.
          </p>
        </header>

        <div className="mt-8">
          <VenueSortableList 
            items={sortedVenues} 
            onSave={saveVenuePreferences.bind(null, id)} 
          />
        </div>
      </div>
    </div>
  )
}
