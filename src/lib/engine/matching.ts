import { createClient } from '@supabase/supabase-js'
import { Database } from '../../../types/database.types'

// Používáme Service Role Key pro bypass RLS v enginu
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Zjistí, zda je uživatel volný v daném čase pro danou skupinu.
 * Bere v úvahu:
 * 1. Recurring dostupnost (pravidelná)
 * 2. One-off dostupnost (konkrétní termín)
 * 3. Výjimky (is_exception = true)
 */
export async function isUserAvailable(
  userId: string, 
  groupId: string, 
  startsAt: Date, 
  endsAt: Date
): Promise<boolean> {
  const dayOfWeek = startsAt.getDay()
  const timeFrom = startsAt.toTimeString().substring(0, 5) // "HH:mm"
  const timeTo = endsAt.toTimeString().substring(0, 5)

  // Načteme veškerou relevantní dostupnost pro uživatele a skupinu
  const { data: availability } = await supabase
    .from('user_availability')
    .select('*')
    .eq('user_id', userId)
    .eq('group_id', groupId)

  if (!availability) return false

  // 1. Kontrola výjimek (pokud existuje "nemůžu" v tento čas, hned končíme)
  const hasException = availability.some(a => 
    a.is_exception && 
    (
      (a.type === 'recurring' && a.day_of_week === dayOfWeek && a.time_from! <= timeFrom && a.time_to! >= timeTo) ||
      (a.type === 'one_off' && new Date(a.starts_at!) <= startsAt && new Date(a.ends_at!) >= endsAt)
    )
  )
  if (hasException) return false

  // 2. Kontrola one-off potvrzení (má přednost před recurring)
  const hasOneOff = availability.some(a => 
    !a.is_exception && 
    a.type === 'one_off' && 
    new Date(a.starts_at!) <= startsAt && 
    new Date(a.ends_at!) >= endsAt
  )
  if (hasOneOff) return true

  // 3. Kontrola pravidelné (recurring) dostupnosti
  const hasRecurring = availability.some(a => 
    !a.is_exception && 
    a.type === 'recurring' && 
    a.day_of_week === dayOfWeek && 
    a.time_from! <= timeFrom && 
    a.time_to! >= timeTo
  )

  return hasRecurring
}

/**
 * Pro daný slot a skupinu zjistí, zda existuje match (dostatek hráčů).
 * Pokud ano, match vytvoří a vrátí.
 */
export async function checkMatchForSlot(slotId: string, groupId: string) {
  // 1. Načíst slot a skupinu
  const [slotRes, groupRes] = await Promise.all([
    supabase.from('slots').select('*').eq('id', slotId).single(),
    supabase.from('groups').select('*').eq('id', groupId).single()
  ])

  const slot = slotRes.data
  const group = groupRes.data

  if (!slot || !slot.is_available || !group) return null

  // 2. Načíst členy skupiny
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)

  if (!members) return null

  // 3. Zkontrolovat dostupnost každého člena
  // (Paralelní check pro rychlost)
  const availabilityChecks = await Promise.all(
    members.map(m => isUserAvailable(
      m.user_id, 
      groupId, 
      new Date(slot.starts_at), 
      new Date(slot.ends_at)
    ))
  )

  const availableMemberIds = members
    .filter((_, index) => availabilityChecks[index])
    .map(m => m.user_id)

  // 4. Pokud je dost hráčů (min_players), vytvořit match (pokud už neexistuje)
  if (availableMemberIds.length >= group.min_players) {
    // Kontrola duplicity
    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .eq('group_id', groupId)
      .eq('slot_id', slotId)
      .single()

    if (existing) return null

    const { data: match, error } = await supabase
      .from('matches')
      .insert({
        group_id: groupId,
        slot_id: slotId
      })
      .select()
      .single()
    
    return match
  }

  return null
}

/**
 * Hlavní trigger: Spustí se při naskenování nových slotů haly.
 * Projde všechny skupiny v daném městě a hledá matche v preferovaných halách.
 */
export async function processNewSlotsForCity(city: string) {
  // 1. Najít všechny aktivní skupiny v městě
  const { data: groups } = await supabase
    .from('groups')
    .select('id, city')
    .eq('city', city)

  if (!groups) return

  // 2. Najít všechny čerstvě naskenované volné sloty v městě
  const { data: slots } = await supabase
    .from('slots')
    .select('*, venues!inner(city)')
    .eq('is_available', true)
    .eq('venues.city', city)
    .gt('starts_at', new Date().toISOString())

  if (!slots) return

  // 3. Pro každou skupinu a každý slot zkusit najít match
  for (const group of groups) {
    for (const slot of slots) {
      await checkMatchForSlot(slot.id, group.id)
    }
  }
}
