'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { checkMatchForSlot } from '@/lib/engine/matching'

export async function triggerMatching(groupId: string) {
  const supabase = await createClient()

  // 1. Ověřit, že uživatel je členem skupiny
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership) throw new Error('Not a member of this group')

  // 2. Najít relevantní sloty v městě skupiny
  const { data: group } = await supabase
    .from('groups')
    .select('city')
    .eq('id', groupId)
    .single()

  if (!group) throw new Error('Group not found')

  const { data: slots } = await supabase
    .from('slots')
    .select('id')
    .eq('is_available', true)
    .gt('starts_at', new Date().toISOString())

  if (slots && slots.length > 0) {
    // Pro každý slot zkusit najít match (toto by mělo být víc optimalizované, ale pro MVP stačí)
    for (const slot of slots) {
      await checkMatchForSlot(slot.id, groupId)
    }
  }

  revalidatePath(`/groups/${groupId}`)
}
