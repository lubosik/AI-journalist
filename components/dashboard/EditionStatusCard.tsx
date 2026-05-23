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

/** Parse a date string safely, treating date-only strings as local midnight
 *  to avoid UTC-offset day-shift (e.g. "2026-05-24" showing as Saturday). */
function parseLocalDate(dateStr: string): Date {
  // If the string is a plain date (YYYY-MM-DD), append T00:00 so it's parsed
  // as local midnight rather than UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00')
  }
  return new Date(dateStr)
}

function getDaysUntil(dateStr: string | null) {
  if (!dateStr) return null
  return Math.ceil((parseLocalDate(dateStr).getTime() - Date.now()) / 86400000)
}

function getWindow(lockedAfter: string | null, publishDate: string | null): string {
  const now = new Date()
  if (lockedAfter && now > parseLocalDate(lockedAfter)) return 'closed'
  if (publishDate) {
    const draft = parseLocalDate(publishDate)
    draft.setDate(draft.getDate() - 2)
    draft.setHours(18, 0, 0, 0)
    if (now >= draft) return 'drafting'
  }
  return 'research'
}

export function EditionStatusCard() {
  const { currentEdition, nextPublishDate, editionLockedAfter, lastDraftDate, loading } = useEditionState()

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
    const d = parseLocalDate(nextPublishDate)
    d.setDate(d.getDate() - 2)
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  })() : null

  const weekOf = nextPublishDate ? (() => {
    // Week starts on the Monday before (or on) the publish date
    const d = parseLocalDate(nextPublishDate)
    const dow = d.getDay() // 0=Sun
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((dow === 0 ? 7 : dow) - 1))
    return monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  })() : null

  return (
    <div className="card p-6">
      <div className="mb-6">
        <p className="text-text-muted text-xs tracking-widest uppercase mb-1">Current Edition</p>
        <h2 className="font-serif text-5xl text-gold">EDITION {toRoman(currentEdition)}</h2>
        {weekOf && (
          <p className="text-text-muted text-xs mt-2">Week of {weekOf}</p>
        )}
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
              {parseLocalDate(nextPublishDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
        {lastDraftDate && (
          <div className="flex justify-between">
            <span className="text-text-muted">Last draft done</span>
            <span className="font-mono text-text-warm text-xs">
              {parseLocalDate(lastDraftDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
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
