import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { format, addDays, isSameDay } from 'date-fns'
import { cs } from 'date-fns/locale'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testVenuesPageLogic() {
  const now = new Date()
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(now, i))

  const { data: allSlots, error } = await supabase
    .from('slots')
    .select('*')
    .gte('starts_at', now.toISOString())
    .lte('starts_at', addDays(now, 7).toISOString())
    .eq('is_available', true)
    .order('starts_at')

  console.log(`allSlots count: ${allSlots?.length}`)
  if (error) console.error(error)

  const { data: venues } = await supabase.from('venues').select('*').eq('slug', 'fit4all')
  const venue = venues![0]

  const venueSlots = allSlots?.filter(s => s.venue_id === venue.id) || []
  console.log(`venueSlots count: ${venueSlots.length}`)

  next7Days.forEach(day => {
    const daySlots = venueSlots.filter(s => isSameDay(new Date(s.starts_at), day))
    console.log(`Day ${format(day, 'yyyy-MM-dd')}: ${daySlots.length} slots`)
  })
}

testVenuesPageLogic()
