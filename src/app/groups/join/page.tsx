import { joinGroup } from './actions'
import Link from 'next/link'

export default function JoinPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 text-text">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-primary">Připojit se ke skupině</h1>
          <p className="mt-2 text-muted">Zadej 8místný zvací kód od správce skupiny.</p>
        </div>

        <form className="mt-8 space-y-6" action={joinGroup}>
          <div>
            <label htmlFor="code" className="sr-only">Zvací kód</label>
            <input
              id="code"
              name="code"
              type="text"
              required
              maxLength={8}
              className="relative block w-full appearance-none rounded-md border border-border bg-surface-2 px-3 py-4 text-center font-mono text-2xl tracking-widest text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              placeholder="XXXXXXXX"
            />
          </div>
          <div className="flex flex-col space-y-3">
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-3 text-sm font-display font-medium text-bg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg"
            >
              Pokračovat
            </button>
            <Link 
              href="/dashboard"
              className="w-full text-center rounded-md border border-border bg-transparent px-4 py-3 text-sm font-display font-medium text-text hover:bg-surface-2"
            >
              Zpět na dashboard
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
