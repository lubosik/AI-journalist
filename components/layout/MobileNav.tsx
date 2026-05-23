'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '◆' },
  { href: '/dashboard/editions', label: 'Editions', icon: '◉' },
  { href: '/dashboard/tracker', label: 'Tracker', icon: '▦' },
  { href: '/dashboard/research', label: 'Research', icon: '◎' },
  { href: '/dashboard/activity', label: 'Activity', icon: '◈' },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg-primary/95 backdrop-blur-xl border-t border-border-dark">
      <nav className="flex">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${isActive ? 'text-gold' : 'text-text-muted'}`}
            >
              <span>{item.icon}</span>
              <span className="tracking-wide">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
