'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveAvailability(
  groupId: string,
  type: 'recurring' | 'one_off',
  data: { dayOfWeek: number, timeFrom: string, timeTo: string }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nepřihlášený uživatel')

  // 1. Smazat starou dostupnost pro daného uživatele, skupinu a typ
  // (pro jednoduchost teď přepisujeme vše, co tam bylo)
  const { error: deleteError } = await supabase
    .from('user_availability')
    .delete()
    .eq('user_id', user.id)
    .eq('group_id', groupId)
    .eq('type', type)

  if (deleteError) throw deleteError

  // 2. Vložit novou dostupnost
  if (data.length > 0) {
    const toInsert = data.map(item => ({
      user_id: user.id,
      group_id: groupId,
      type: type,
      day_of_week: item.dayOfWeek,
      time_from: item.timeFrom,
      time_to: item.timeTo,
      is_exception: false
    }))

    const { error: insertError } = await supabase
      .from('user_availability')
      .insert(toInsert)
    
    if (insertError) throw insertError
  }

  revalidatePath(`/groups/${groupId}/availability`)
  revalidatePath(`/groups/${groupId}`)
}
