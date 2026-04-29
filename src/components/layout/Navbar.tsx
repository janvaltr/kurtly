import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-8 h-20 flex items-center justify-between">
        <Link href="/dashboard" className="transition-opacity hover:opacity-80">
          <img src="/logo.svg" alt="Kurtly" className="h-8 w-auto" />
        </Link>
        <div className="flex items-center space-x-6 text-sm font-medium text-muted">
          <Link href="/venues" className="hover:text-text transition-colors">Průzkumník hal</Link>
          <Link href="/dashboard" className="hover:text-text transition-colors">Moje skupiny</Link>
        </div>
      </div>
    </nav>
  )
}
