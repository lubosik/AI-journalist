'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '◆' },
  { href: '/dashboard/editions', label: 'Editions', icon: '◉' },
  { href: '/dashboard/tracker', label: 'Tracker', icon: '▦' },
  { href: '/dashboard/research', label: 'Research', icon: '◎' },
  { href: '/dashboard/settings', label: 'Settings', icon: '◇' },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg-primary/95 backdrop-blur-xl border-t border-border-dark pb-6">
      <nav className="flex">
        {navItems.map(item => {
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
      </nav>
    </div>
  )
}
