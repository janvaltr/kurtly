'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveVenuePreferences(
  groupId: string,
  venueIds: string[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nepřihlášený uživatel')

  // 1. Smazat staré preference pro tohoto uživatele v této skupině
  const { error: deleteError } = await supabase
    .from('venue_preferences')
    .delete()
    .eq('user_id', user.id)
    .eq('group_id', groupId)

  if (deleteError) throw deleteError

  // 2. Vložit nové s rankem (pořadím)
  if (venueIds.length > 0) {
    const toInsert = venueIds.map((venueId, index) => ({
      group_id: groupId,
      user_id: user.id,
      venue_id: venueId,
      rank: index + 1
    }))

    const { error: insertError } = await supabase
      .from('venue_preferences')
      .insert(toInsert)
    
    if (insertError) throw insertError
  }

  revalidatePath(`/groups/${groupId}/venues`)
  revalidatePath(`/groups/${groupId}`)
}
