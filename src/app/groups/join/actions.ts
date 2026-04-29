'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function joinGroup(formData: FormData) {
  const code = formData.get('code') as string
  if (!code) return

  redirect(`/groups/join/${code.toUpperCase().trim()}`)
}
