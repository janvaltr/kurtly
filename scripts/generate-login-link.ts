import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function generateLink() {
  const email = process.argv[2]
  if (!email) {
    console.error('Zadej email jako argument: npx tsx scripts/generate-login-link.ts tvuj@email.cz')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
    options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
    }
  })

  if (error) {
    console.error('Chyba:', error.message)
  } else {
    console.log('\n--- PŘIHLAŠOVACÍ ODKAZ ---')
    console.log(data.properties.action_link)
    console.log('--------------------------\n')
  }
}

generateLink()
