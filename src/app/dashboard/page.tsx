import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Načtení skupin uživatele
  const { data: groupMembers } = await supabase
    .from('group_members')
    .select('groups (*)')
    .eq('user_id', user.id)

  // Ignorujeme typové varování pro prototypování, jelikož typy jsou generované
  const groups = groupMembers?.map((gm: any) => gm.groups).filter(Boolean) || []

  return (
    <div className="flex min-h-screen flex-col bg-bg p-8 text-text">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold text-primary">Tvoje skupiny</h1>
          <div className="flex space-x-4">
            <Link
              href="/groups/join"
              className="rounded-md border border-border bg-surface px-4 py-2 font-display text-sm font-medium hover:bg-surface-2"
            >
              Připojit se
            </Link>
            <Link
              href="/groups/new"
              className="rounded-md bg-primary px-4 py-2 font-display text-sm font-medium text-bg hover:bg-primary/90"
            >
              + Nová skupina
            </Link>
          </div>
        </header>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center">
            <p className="text-muted">Zatím nejsi v žádné skupině.</p>
            <div className="mt-6 flex justify-center space-x-4">
              <Link
                href="/groups/new"
                className="rounded-md bg-primary px-4 py-2 font-display text-sm font-medium text-bg hover:bg-primary/90"
              >
                Vytvořit první skupinu
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group: any) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="group rounded-xl border border-border bg-surface p-6 transition-colors hover:border-primary hover:bg-surface-2"
              >
                <h3 className="font-display text-xl font-semibold text-text group-hover:text-primary">
                  {group.name}
                </h3>
                <p className="mt-2 text-sm text-muted">{group.sport} • {group.city}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
