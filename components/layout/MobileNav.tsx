'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { useActivityFeed } from '@/hooks/useActivityFeed'

const LS_ACTIVITY_SEEN = 'herald_activity_last_seen'

const baseNavItems = [
  { href: '/dashboard', label: 'Home', icon: '◆' },
  { href: '/dashboard/editions', label: 'Editions', icon: '◉' },
  { href: '/dashboard/tracker', label: 'Tracker', icon: '▦' },
  { href: '/dashboard/research', label: 'Research', icon: '◎' },
]

export function MobileNav() {
  const pathname = usePathname()
  const { events } = useActivityFeed(1)
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    if (events.length === 0) return
    const lastSeen = localStorage.getItem(LS_ACTIVITY_SEEN)
    const latestTs = events[0].timestamp
    if (!lastSeen || new Date(latestTs).getTime() > new Date(lastSeen).getTime()) {
      setHasUnread(true)
    }
  }, [events])

  const handleActivityClick = () => {
    if (events.length > 0) {
      localStorage.setItem(LS_ACTIVITY_SEEN, events[0].timestamp)
    }
    setHasUnread(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg-primary/95 backdrop-blur-xl border-t border-border-dark pb-6">
      <nav className="flex">
        {baseNavItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 text-[10px] tracking-wide transition-colors ${
                isActive
                  ? 'text-gold'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <span className={`text-base leading-none ${isActive ? 'text-gold' : ''}`}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* Activity tab */}
        <Link
          href="/dashboard/activity"
          onClick={handleActivityClick}
          className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 text-[10px] tracking-wide transition-colors relative ${
            pathname.startsWith('/dashboard/activity')
              ? 'text-gold'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <span className="relative">
            <Zap
              size={16}
              className={pathname.startsWith('/dashboard/activity') ? 'text-gold' : ''}
            />
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
              </span>
            )}
          </span>
          <span>Activity</span>
        </Link>
      </nav>
    </div>
  )
}
