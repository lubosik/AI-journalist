'use client'
import { useActivityFeed } from '@/hooks/useActivityFeed'

const eventConfig: Record<string, { color: string; dot: string }> = {
  INGESTION: { color: 'text-text-secondary', dot: 'bg-gold-muted' },
  RESEARCH: { color: 'text-text-secondary', dot: 'bg-blue-900' },
  DRAFT_START: { color: 'text-gold', dot: 'bg-gold' },
  DRAFT_READY: { color: 'text-gold-light', dot: 'bg-gold-light' },
  PUBLISHED: { color: 'text-success-dark', dot: 'bg-success-dark' },
  MORNING_BRIEF: { color: 'text-text-warm', dot: 'bg-text-secondary' },
  TELEGRAM_TIP: { color: 'text-text-muted', dot: 'bg-border-dark' },
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(ts: string) {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ActivityFeed() {
  const { events, loading } = useActivityFeed(50)

  if (loading) {
    return (
      <div className="card p-6">
        <h3 className="font-serif text-lg text-text-warm mb-6">Activity</h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-bg-elevated mt-1.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-bg-elevated rounded w-3/4 mb-2" />
                <div className="h-2 bg-bg-elevated rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <h3 className="font-serif text-lg text-text-warm mb-6">Live Activity</h3>
      <div className="relative">
        <div className="absolute left-[3px] top-0 bottom-0 w-px bg-border-gold" />
        <div className="space-y-0 max-h-96 overflow-y-auto pr-2">
          {events.length === 0 ? (
            <p className="text-text-muted text-sm pl-6">No activity yet</p>
          ) : events.map((event, idx) => {
            const config = eventConfig[event.type] || eventConfig.INGESTION
            return (
              <div key={event.id + idx} className="flex gap-4 pb-4 animate-fade-in">
                <div className={`w-2 h-2 rounded-full ${config.dot} mt-1.5 flex-shrink-0 relative z-10`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${config.color} truncate`}>{event.message}</p>
                  <p className="text-text-muted text-xs font-mono mt-0.5">
                    {formatDate(event.timestamp)} {formatTime(event.timestamp)}
                    {event.source && <span className="ml-2 text-border-gold">{event.source}</span>}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
