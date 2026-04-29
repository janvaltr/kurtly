import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const { data: groupMembers } = await supabase
    .from('group_members')
    .select(`
      groups (
        id,
        name,
        sport,
        city,
        min_players
      )
    `)
    .eq('user_id', user.id)

  const groups = groupMembers?.map((gm: any) => gm.groups).filter(Boolean) || []

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-6xl px-8 py-12 space-y-12">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-5xl font-black text-text italic tracking-tighter leading-none uppercase">TVOJE SKUPINY</h1>
          <div className="flex space-x-4">
            <Link
              href="/venues"
              className="rounded-xl border-2 border-border bg-white px-6 py-3 font-display text-sm font-bold hover:border-primary transition-all shadow-sm"
            >
              🏢 Průzkumník hal
            </Link>
            <Link
              href="/groups/join"
              className="rounded-xl border-2 border-border bg-white px-6 py-3 font-display text-sm font-bold hover:border-primary transition-all shadow-sm"
            >
              Připojit se
            </Link>
            <Link
              href="/groups/new"
              className="rounded-xl bg-primary px-6 py-3 font-display text-sm font-bold text-bg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              + Nová skupina
            </Link>
          </div>
        </header>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-3xl border-2 border-dashed border-border bg-surface/50">
            <p className="text-xl font-bold text-muted">Zatím nejsi v žádné skupině.</p>
            <Link href="/groups/new" className="mt-6 text-primary font-bold hover:underline">
              Vytvoř si svoji první skupinu →
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group: any) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="group flex flex-col justify-between rounded-2xl border-2 border-border bg-white p-8 transition-all hover:border-primary hover:shadow-2xl hover:shadow-primary/5"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-primary/10 px-2 py-1 rounded">
                      {group.sport}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                      {group.city}
                    </span>
                  </div>
                  <h2 className="font-display text-3xl font-black text-text leading-tight group-hover:text-primary transition-colors">
                    {group.name}
                  </h2>
                </div>
                <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
                  <span className="text-xs font-bold text-muted uppercase tracking-widest">
                    Min. hráčů: {group.min_players}
                  </span>
                  <span className="text-primary font-bold uppercase tracking-widest text-xs group-hover:translate-x-1 transition-transform">
                    Detail →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
