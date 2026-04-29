import { createGroup } from './actions'
import Link from 'next/link'

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 text-text">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-primary">Nová skupina</h1>
          <p className="mt-2 text-muted">Založ novou skupinu a pozvi spoluhráče.</p>
        </div>
        
        {error && (
          <div className="rounded-md bg-destructive/20 p-4 text-sm text-destructive border border-destructive/50">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" action={createGroup}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-muted">
                Název skupiny
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1 block w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
                placeholder="Např. Středeční badáč"
              />
            </div>
            
            <div>
              <label htmlFor="sport" className="block text-sm font-medium text-muted">
                Sport
              </label>
              <select
                id="sport"
                name="sport"
                className="mt-1 block w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              >
                <option value="badminton">Badminton</option>
                <option value="squash">Squash</option>
                <option value="tenis">Tenis</option>
              </select>
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-muted">
                Město
              </label>
              <input
                id="city"
                name="city"
                type="text"
                required
                defaultValue="Brno"
                className="mt-1 block w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col space-y-3">
            <button
              type="submit"
              className="w-full justify-center rounded-md bg-primary px-4 py-3 text-sm font-display font-medium text-bg hover:bg-primary/90 focus:outline-none"
            >
              Vytvořit skupinu
            </button>
            <Link 
              href="/dashboard"
              className="w-full text-center rounded-md border border-border bg-transparent px-4 py-3 text-sm font-display font-medium text-text hover:bg-surface-2"
            >
              Zrušit
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
