'use client'
import { useRouter } from 'next/navigation'

export function TopBar() {
  const router = useRouter()
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  return (
    <div className="h-14 bg-bg-secondary border-b border-border-dark flex items-center justify-between px-4 md:px-6">
      <span className="text-text-muted text-xs tracking-widest uppercase hidden sm:block">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </span>
      <span className="text-text-muted text-xs tracking-widest uppercase sm:hidden">
        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
      <button
        onClick={handleLogout}
        className="text-text-muted text-xs hover:text-text-secondary transition-colors tracking-widest uppercase min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        Sign Out
      </button>
    </div>
  )
}
