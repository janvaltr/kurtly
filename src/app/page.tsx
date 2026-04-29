import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="font-display text-5xl font-bold text-primary">Kurtly</h1>
      <p className="mt-4 text-xl text-muted">Badminton bez WhatsApp koordinace.</p>
      
      <div className="mt-12 flex space-x-4">
        <Link 
          href="/auth/login"
          className="rounded-lg bg-primary px-6 py-3 font-display font-semibold text-bg transition hover:bg-primary/90"
        >
          Začít zdarma →
        </Link>
      </div>

      <div className="mt-24 grid gap-8 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold text-text">1. Nastav dostupnost</h3>
          <p className="mt-2 text-sm text-muted">Zadej, kdy a kde můžeš hrát. Stačí jednou.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold text-text">2. Vyber haly</h3>
          <p className="mt-2 text-sm text-muted">Aplikace neustále hlídá volné kurty na pozadí.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold text-text">3. Dostaň notifikaci</h3>
          <p className="mt-2 text-sm text-muted">Jakmile je volno, dostaneš push notifikaci. Jdi a rezervuj.</p>
        </div>
      </div>
    </div>
  )
}
