'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '◆' },
  { href: '/dashboard/editions', label: 'Editions', icon: '◉' },
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

export function Sidebar() {
  const pathname = usePathname()
  const [editionNum, setEditionNum] = useState('...')

  useEffect(() => {
    supabase
      .from('pipeline_state')
      .select('key, value')
      .eq('key', 'current_edition_number')
      .single()
      .then(({ data }) => { if (data) setEditionNum(data.value) })
  }, [])

  return (
    <div className="w-60 h-screen bg-bg-secondary border-r border-border-dark flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-border-dark">
        <h1 className="font-serif text-2xl text-gold tracking-widest">HERALD</h1>
        <p className="text-text-muted text-xs tracking-[0.15em] uppercase mt-1">Intelligence Dashboard</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
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
      <div className="p-4 border-t border-border-dark">
        <p className="text-text-muted text-xs tracking-[0.15em] uppercase">
          EDITION {toRoman(parseInt(editionNum) || 5)} - RESEARCHING
        </p>
      </div>
    </div>
  )
}
