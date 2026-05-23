'use client'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'

export default function ActivityPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-text-warm">Activity Log</h1>
        <div className="gold-divider mt-3" />
      </div>
      <ActivityFeed />
    </div>
  )
}
