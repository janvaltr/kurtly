import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MatchCard from '@/components/groups/MatchCard'
import MatchTriggerButton from './MatchTriggerButton'

export default async function GroupPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: group } = await supabase
    .from('groups')
    .select('*, group_members(*)')
    .eq('id', id)
    .single()

  if (!group) {
    redirect('/dashboard')
  }

  const isMember = group.group_members.some((m: any) => m.user_id === user.id)
  if (!isMember) {
    redirect('/dashboard')
  }

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
    <div className="min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-6xl px-8 py-12 space-y-12">
        <header className="flex items-end justify-between border-b-4 border-primary/20 pb-8">
          <div>
            <Link href="/dashboard" className="text-xs font-black uppercase tracking-widest text-muted hover:text-primary transition-colors">← Zpět na dashboard</Link>
            <h1 className="mt-4 font-display text-5xl font-black text-text italic tracking-tighter leading-none uppercase">{group.name}</h1>
            <p className="mt-2 text-lg font-bold text-muted uppercase tracking-widest">{group.sport} • {group.city}</p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-white px-8 py-4 text-center shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-1">Zvací kód</p>
            <p className="font-display text-3xl font-black tracking-[0.3em] text-primary">{group.invite_code}</p>
          </div>
        </header>

        <div className="flex justify-between items-center bg-surface p-4 rounded-2xl border-2 border-border">
          <div className="flex space-x-4">
            <Link
              href={`/groups/${id}/availability`}
              className="rounded-xl bg-white border-2 border-border px-6 py-3 text-sm font-bold hover:border-primary transition-all shadow-sm flex items-center space-x-2"
            >
              <span>🗓️ Moje dostupnost</span>
            </Link>
            <Link
              href={`/groups/${id}/venues`}
              className="rounded-xl bg-white border-2 border-border px-6 py-3 text-sm font-bold hover:border-primary transition-all shadow-sm flex items-center space-x-2"
            >
              <span>🏢 Preferované haly</span>
            </Link>
          </div>
          <MatchTriggerButton groupId={id} />
        </div>

        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <h2 className="font-display text-3xl font-black text-text uppercase tracking-tight italic">Nalezené termíny</h2>
            {matches && matches.length > 0 ? (
              <div className="grid gap-6">
                {matches.map((match: any) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border-2 border-dashed border-border p-16 text-center bg-surface/30">
                <p className="text-xl font-bold text-muted">Zatím jsme pro vaši skupinu nenašli žádný volný termín.</p>
                <p className="text-sm text-muted/60 mt-4 max-w-sm mx-auto">
                  Zkuste kliknout na tlačítko <strong>Hledat zápasy</strong> výše nebo upravte svoji dostupnost.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <h2 className="font-display text-3xl font-black text-text uppercase tracking-tight italic">Tým</h2>
            <div className="space-y-4">
              {group.group_members.map((member: any) => (
                <div key={member.user_id} className="flex items-center justify-between rounded-2xl border-2 border-border bg-white p-5 shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black">
                      {member.role === 'admin' ? 'A' : 'M'}
                    </div>
                    <div>
                      <p className="font-bold text-text">{member.user_id === user.id ? 'Ty' : 'Hráč'}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted">{member.role}</p>
                    </div>
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
