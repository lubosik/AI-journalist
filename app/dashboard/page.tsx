import { EditionStatusCard } from '@/components/dashboard/EditionStatusCard'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { DatabaseStats } from '@/components/dashboard/DatabaseStats'
import ResearchPanel from '@/components/dashboard/ResearchPanel'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-xl md:text-3xl text-text-warm">Intelligence Overview</h1>
        <div className="gold-divider mt-3" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <EditionStatusCard />
          <ResearchPanel />
          <div className="card p-6">
            <h3 className="font-serif text-lg text-text-warm mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href="/dashboard/editions"
                className="block w-full text-center border border-gold-muted text-gold text-xs py-2 rounded tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all duration-300"
              >
                View Latest Draft
              </Link>
              <Link
                href="/dashboard/research"
                className="block w-full text-center border border-border-dark text-text-secondary text-xs py-2 rounded tracking-widest uppercase hover:border-gold-muted hover:text-gold transition-all duration-300"
              >
                Research Database
              </Link>
              <Link
                href="/dashboard/activity"
                className="block w-full text-center border border-border-dark text-text-secondary text-xs py-2 rounded tracking-widest uppercase hover:border-gold-muted hover:text-gold transition-all duration-300"
              >
                Full Activity Log
              </Link>
            </div>
          </div>
        </div>
        <div className="lg:col-span-1"><ActivityFeed /></div>
        <div className="lg:col-span-1"><DatabaseStats /></div>
      </div>
    </div>
  )
}
