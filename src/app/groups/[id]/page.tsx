import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MatchCard from '@/components/groups/MatchCard'

export default async function GroupPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Načtení detailu skupiny a členů
  const { data: group } = await supabase
    .from('groups')
    .select('*, group_members(*)')
    .eq('id', id)
    .single()

  if (!group) {
    redirect('/dashboard')
  }

  // Zkontrolujeme, jestli je uživatel členem
  const isMember = group.group_members.some((m: any) => m.user_id === user.id)
  if (!isMember) {
    redirect('/dashboard')
  }

  // Načtení matchů pro tuto skupinu (včetně detailů slotu a haly)
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      slots (
        *,
        venues (*)
      )
    `)
    .eq('group_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex min-h-screen flex-col bg-bg p-8 text-text">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <Link href="/dashboard" className="text-sm text-muted hover:text-text">← Zpět na dashboard</Link>
            <h1 className="mt-2 font-display text-3xl font-bold text-primary">{group.name}</h1>
            <p className="text-muted">{group.sport} • {group.city}</p>
          </div>
          <div className="rounded-md border border-border bg-surface px-6 py-3 text-center">
            <p className="text-xs uppercase tracking-wider text-muted">Zvací kód</p>
            <p className="font-mono text-2xl font-bold tracking-widest text-text">{group.invite_code}</p>
          </div>
        </header>

        <div className="flex justify-end space-x-3">
          <Link
            href={`/groups/${id}/availability`}
            className="rounded-md bg-surface-2 border border-border px-4 py-2 text-sm font-medium hover:bg-surface transition-colors"
          >
            🗓️ Dostupnost
          </Link>
          <Link
            href={`/groups/${id}/venues`}
            className="rounded-md bg-surface-2 border border-border px-4 py-2 text-sm font-medium hover:bg-surface transition-colors"
          >
            🏢 Preference hal
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <h2 className="font-display text-2xl font-bold">Nalezené termíny</h2>
            {matches && matches.length > 0 ? (
              <div className="grid gap-4">
                {matches.map((match: any) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-12 text-center">
                <p className="text-muted">Zatím jsme pro vaši skupinu nenašli žádný volný termín.</p>
                <p className="text-xs text-muted/50 mt-2">Zkontrolujte, zda máte nastavenou dostupnost a preference hal.</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="font-display text-2xl font-bold">Členové</h2>
            <div className="space-y-3">
              {group.group_members.map((member: any) => (
                <div key={member.user_id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                      {member.role === 'admin' ? 'A' : 'M'}
                    </div>
                    <span className="text-sm font-medium">{member.user_id === user.id ? 'Ty' : 'Hráč'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
