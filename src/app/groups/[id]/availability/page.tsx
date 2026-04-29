import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AvailabilityClient from './AvailabilityClient'

export default async function AvailabilityPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Načtení existující dostupnosti
  const { data: availability } = await supabase
    .from('user_availability')
    .select('*')
    .eq('group_id', id)
    .eq('user_id', user.id)
    .eq('type', 'recurring')

  const formattedData = availability?.map(a => ({
    dayOfWeek: a.day_of_week,
    timeFrom: a.time_from?.substring(0, 5), // 'HH:mm'
    timeTo: a.time_to?.substring(0, 5)
  })) || []

  return (
    <div className="flex min-h-screen flex-col bg-bg p-8 text-text">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="flex flex-col space-y-2">
          <Link href={`/groups/${id}`} className="text-sm text-muted hover:text-text">← Zpět do skupiny</Link>
          <h1 className="font-display text-3xl font-bold text-primary">Moje dostupnost</h1>
          <p className="text-muted">Označ časy v týdnu, kdy obvykle můžeš hrát.</p>
        </header>

        <AvailabilityClient groupId={id} initialData={formattedData} />
      </div>
    </div>
  )
}
