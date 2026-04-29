'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function confirmJoin(groupId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: user.id,
      role: 'member'
    })

  if (error) {
    // Už je možná členem, nebo jiná chyba (ignorujeme pro prototyp a rovnou přesměrujeme)
    // Ideálně by to chtělo lepší error handling
  }

  redirect(`/groups/${groupId}`)
}
