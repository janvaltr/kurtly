'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createGroup(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const name = formData.get('name') as string
  const city = formData.get('city') as string
  const sport = formData.get('sport') as string

  // Vygenerování 8-znakového náhodného kódu pro pozvánku
  const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase()

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      name,
      city,
      sport,
      invite_code: inviteCode,
      created_by: user.id
    })
    .select()
    .single()

  if (error || !group) {
    redirect('/groups/new?error=' + encodeURIComponent(error?.message || 'Chyba při vytváření skupiny'))
  }

  // Přidání tvůrce jako admina skupiny
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'admin'
    })

  if (memberError) {
     redirect('/groups/new?error=' + encodeURIComponent(memberError.message))
  }

  redirect(`/groups/${group.id}`)
}
