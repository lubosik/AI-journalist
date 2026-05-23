'use client'
import { useRouter } from 'next/navigation'

export function TopBar() {
  const router = useRouter()
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  return (
    <div className="h-14 bg-bg-secondary border-b border-border-dark flex items-center justify-between px-6">
      <span className="text-text-muted text-xs tracking-widest uppercase">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </span>
      <button
        onClick={handleLogout}
        className="text-text-muted text-xs hover:text-text-secondary transition-colors tracking-widest uppercase"
      >
        Sign Out
      </button>
    </div>
  )
}
