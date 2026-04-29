import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const { message } = await searchParams

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 text-text">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-primary">Kurtly</h1>
          <p className="mt-2 text-muted">Badminton bez WhatsApp koordinace.</p>
        </div>
        
        {message && (
          <div className="rounded-md bg-surface-2 p-4 text-sm text-text border border-border">
            {message}
          </div>
        )}

        <form className="mt-8 space-y-6" action={login}>
          <div>
            <label htmlFor="email" className="sr-only">
              E-mailová adresa
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="relative block w-full appearance-none rounded-md border border-border bg-surface-2 px-3 py-3 text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              placeholder="E-mailová adresa"
            />
          </div>
          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-3 text-sm font-display font-medium text-bg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg"
            >
              Pošleme ti přihlašovací odkaz
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
