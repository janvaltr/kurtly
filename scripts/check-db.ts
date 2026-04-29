import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkDb() {
  console.log('--- CHECK SLOTS IN DB ---')
  
  const { data: venues, error: vErr } = await supabase.from('venues').select('*')
  console.log('Venues:', venues)

  const { data: slots, error: sErr } = await supabase.from('slots').select('id, venue_id, starts_at, is_available').limit(10)
  
  const { count } = await supabase.from('slots').select('*', { count: 'exact', head: true })
  console.log('Total slots count:', count)
  console.log('Sample slots:', slots)
  
  console.log('--- END CHECK ---')
}

checkDb()
