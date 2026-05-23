'use client'
import { useEditionState } from '@/hooks/useEditionState'
import { StatusBadge } from '@/components/ui/StatusBadge'

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

function getDaysUntil(dateStr: string | null) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function getWindow(lockedAfter: string | null, publishDate: string | null): string {
  const now = new Date()
  if (lockedAfter && now > new Date(lockedAfter)) return 'closed'
  if (publishDate) {
    const draft = new Date(publishDate)
    draft.setDate(draft.getDate() - 2)
    draft.setHours(18, 0, 0, 0)
    if (now >= draft) return 'drafting'
  }
  return 'research'
}

export function EditionStatusCard() {
  const { currentEdition, nextPublishDate, editionLockedAfter, loading } = useEditionState()

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-16 bg-bg-elevated rounded mb-4" />
        <div className="h-4 bg-bg-elevated rounded w-2/3" />
      </div>
    )
  }

  const days = getDaysUntil(nextPublishDate)
  const window_ = getWindow(editionLockedAfter, nextPublishDate)
  const statusMap: Record<string, string> = { research: 'research', drafting: 'drafting', closed: 'published' }

  const draftDate = nextPublishDate ? (() => {
    const d = new Date(nextPublishDate)
    d.setDate(d.getDate() - 2)
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  })() : null

  return (
    <div className="card p-6">
      <div className="mb-6">
        <p className="text-text-muted text-xs tracking-widest uppercase mb-1">Current Edition</p>
        <h2 className="font-serif text-5xl text-gold">EDITION {toRoman(currentEdition)}</h2>
      </div>
      <div className="mb-4">
        <StatusBadge status={statusMap[window_] || 'research'} />
      </div>
      <div className="space-y-3 text-sm">
        {days !== null && (
          <div className="flex justify-between">
            <span className="text-text-muted">Days until publish</span>
            <span className="font-mono text-text-warm">{days > 0 ? days : 'Today'}</span>
          </div>
        )}
        {nextPublishDate && (
          <div className="flex justify-between">
            <span className="text-text-muted">Publish date</span>
            <span className="font-mono text-text-warm text-xs">
              {new Date(nextPublishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
        {draftDate && (
          <div className="flex justify-between">
            <span className="text-text-muted">Draft opens</span>
            <span className="font-mono text-text-warm text-xs">{draftDate}, 6pm ET</span>
          </div>
        )}
      </div>
      <div className="mt-6">
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span>Research</span><span>Draft</span><span>Approved</span><span>Published</span>
        </div>
        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-500"
            style={{ width: window_ === 'research' ? '25%' : window_ === 'drafting' ? '50%' : '75%' }}
          />
        </div>
      </div>
    </div>
  )
}
