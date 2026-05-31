'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActivityFeed } from '@/hooks/useActivityFeed'
import { useEditionState } from '@/hooks/useEditionState'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '◆' },
  { href: '/dashboard/editions', label: 'Editions', icon: '◉' },
  { href: '/dashboard/tracker', label: 'Tracker', icon: '▦' },
  { href: '/dashboard/research', label: 'Research', icon: '◎' },
  { href: '/dashboard/activity', label: 'Activity', icon: '◈' },
  { href: '/dashboard/settings', label: 'Settings', icon: '◇' },
]

const toRoman = (n: number) => {
  if (n <= 0) return '?'
  const vals = [10, 9, 5, 4, 1]
  const syms = ['X', 'IX', 'V', 'IV', 'I']
  let r = ''
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { r += syms[i]; n -= vals[i] }
  }
  return r
}

const EVENT_COLOR: Record<string, string> = {
  INGESTION: 'bg-blue-400',
  RESEARCH: 'bg-purple-400',
  DRAFT_START: 'bg-yellow-400',
  DRAFT_READY: 'bg-orange-400',
  PUBLISHED: 'bg-green-400',
  MORNING_BRIEF: 'bg-gold',
  TELEGRAM_TIP: 'bg-sky-400',
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

const LS_ACTIVITY_OPEN = 'herald_sidebar_activity_open'

function ActivityFeed() {
  const { events, loading } = useActivityFeed(5)
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(LS_ACTIVITY_OPEN) === 'true'
  })

  const toggle = () => {
    setOpen(prev => {
      const next = !prev
      localStorage.setItem(LS_ACTIVITY_OPEN, String(next))
      return next
    })
  }

  return (
    <div className="border-t border-border-dark">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        <span className="flex items-center gap-2 tracking-widest uppercase">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
          </span>
          Live Activity
        </span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="max-h-48 overflow-y-auto px-4 pb-3 space-y-2">
          {loading && (
            <p className="text-text-muted text-xs">Loading...</p>
          )}
          {!loading && events.length === 0 && (
            <p className="text-text-muted text-xs">No recent activity</p>
          )}
          {events.map(event => (
            <div key={event.id} className="flex items-start gap-2 min-w-0">
              <span className={`mt-1.5 flex-shrink-0 h-1.5 w-1.5 rounded-full ${EVENT_COLOR[event.type] ?? 'bg-text-muted'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-text-secondary text-xs truncate leading-snug">{event.message}</p>
              </div>
              <span className="flex-shrink-0 text-text-muted text-[10px] font-mono">{timeAgo(event.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { currentEdition } = useEditionState()
  const editionNum = currentEdition || 1

  return (
    <div className="w-60 h-screen bg-bg-secondary border-r border-border-dark flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-border-dark">
        <h1 className="font-serif text-xl text-gold tracking-wider leading-tight">The AI Journalist</h1>
        <p className="text-text-muted text-xs tracking-[0.15em] uppercase mt-1">Intelligence Dashboard</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all duration-200 ${
                isActive
                  ? 'text-gold border-l-2 border-gold bg-gold/5 -ml-px pl-[calc(1rem-2px)]'
                  : 'text-text-secondary hover:text-text-warm hover:bg-white/5'
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              <span className="tracking-wide">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <ActivityFeed />
      <div className="p-4 border-t border-border-dark">
        <p className="text-text-muted text-xs tracking-[0.15em] uppercase">
          EDITION {toRoman(editionNum)} - RESEARCHING
        </p>
      </div>
    </div>
  )
}
