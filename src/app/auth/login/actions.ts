'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Must be configured in Supabase dashboard under Authentication -> URL Configuration
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    redirect('/auth/login?message=' + encodeURIComponent('Chyba při odesílání odkazu: ' + error.message))
  }

  redirect('/auth/login?message=' + encodeURIComponent('Odkaz byl odeslán! Zkontroluj svůj e-mail.'))
}
