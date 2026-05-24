'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function useEstClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const est = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York',
        hour12: true,
      })
      setTime(`${est} EST`)
    }
    tick()
    // Align to the next minute boundary, then tick every 60s
    const now = new Date()
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    const timeout = setTimeout(() => {
      tick()
      const interval = setInterval(tick, 60000)
      return () => clearInterval(interval)
    }, msUntilNextMinute)
    return () => clearTimeout(timeout)
  }, [])

  return time
}

export function TopBar() {
  const router = useRouter()
  const estTime = useEstClock()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="h-14 bg-bg-secondary border-b border-border-dark flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-4">
        <span className="text-text-muted text-xs tracking-widest uppercase hidden sm:block">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
        <span className="text-text-muted text-xs tracking-widest uppercase sm:hidden">
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        {estTime && (
          <span className="text-gold text-xs font-mono tracking-widest border border-gold-muted px-2 py-0.5 rounded">
            {estTime}
          </span>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="text-text-muted text-xs hover:text-text-secondary transition-colors tracking-widest uppercase min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        Sign Out
      </button>
    </div>
  )
}
