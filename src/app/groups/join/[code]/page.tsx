import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { confirmJoin } from './actions'

export default async function JoinCodePage({
  params
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Najdeme skupinu podle invite kódu
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .single()

  if (!group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 text-text">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-display font-bold text-destructive">Neplatný kód</h1>
          <p className="text-muted">Skupina s kódem {code} nebyla nalezena.</p>
          <Link href="/groups/join" className="mt-4 inline-block text-primary hover:underline">
            Zkusit zadat kód znovu
          </Link>
        </div>
      </div>
    )
  }

  // Bind the groupId to the server action
  const confirmAction = confirmJoin.bind(null, group.id)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 text-text">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-surface p-8 shadow-lg text-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-text">{group.name}</h1>
          <p className="mt-2 text-muted">{group.sport} • {group.city}</p>
        </div>
        
        <form action={confirmAction} className="mt-8 space-y-4">
          <button
            type="submit"
            className="w-full justify-center rounded-md bg-primary px-4 py-3 text-sm font-display font-medium text-bg hover:bg-primary/90"
          >
            Připojit se ke skupině
          </button>
          <Link 
            href="/dashboard"
            className="block w-full text-center rounded-md border border-border bg-transparent px-4 py-3 text-sm font-display font-medium text-text hover:bg-surface-2"
          >
            Zrušit
          </Link>
        </form>
      </div>
    </div>
  )
}
