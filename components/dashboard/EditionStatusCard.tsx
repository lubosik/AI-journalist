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

// Treat bare YYYY-MM-DD strings as local midnight to avoid UTC-offset day shift
function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00')
  }
  return new Date(dateStr)
}

// Next Sunday on or after a given date
function nextSunday(from: Date): Date {
  const d = new Date(from)
  const dow = d.getDay() // 0 = Sunday
  if (dow === 0) return d
  d.setDate(d.getDate() + (7 - dow))
  return d
}

function getDaysUntil(dateStr: string | null) {
  if (!dateStr) return null
  return Math.ceil((parseLocalDate(dateStr).getTime() - Date.now()) / 86400000)
}

function formatDeadline(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function getWindow(lockedAfter: string | null, deadlineDate: string | null): string {
  const now = new Date()
  if (lockedAfter && now > new Date(lockedAfter)) return 'closed'
  if (deadlineDate) {
    const draft = parseLocalDate(deadlineDate)
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

  const now = new Date()
  const deadlineDate = nextPublishDate

  // After deadline passes, show next edition info
  const deadlinePassed = deadlineDate ? now > parseLocalDate(deadlineDate) : false
  const displayEdition = deadlinePassed ? currentEdition + 1 : currentEdition

  // Next deadline is the Sunday after the current one
  const nextDeadline = deadlineDate
    ? (() => {
        const d = parseLocalDate(deadlineDate)
        if (deadlinePassed) {
          return nextSunday(new Date(d.getTime() + 7 * 86400000))
        }
        return d
      })()
    : null

  const days = nextDeadline ? getDaysUntil(nextDeadline.toISOString().slice(0, 10)) : null
  const window_ = getWindow(editionLockedAfter, deadlineDate)

  // Week of label: Monday before the deadline Sunday
  const weekOf = nextDeadline
    ? (() => {
        const d = new Date(nextDeadline)
        const dow = d.getDay()
        const monday = new Date(d)
        monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
        return monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      })()
    : null

  const statusMap: Record<string, string> = {
    research: 'research',
    drafting: 'drafting',
    closed: deadlinePassed ? 'published' : 'published',
  }

  return (
    <div className="card p-6">
      <div className="mb-6">
        <p className="text-text-muted text-xs tracking-widest uppercase mb-1">
          {deadlinePassed ? 'Next Edition' : 'Current Edition'}
        </p>
        <h2 className="font-serif text-5xl text-gold">EDITION {toRoman(displayEdition)}</h2>
        {weekOf && (
          <p className="text-text-muted text-xs mt-2">Week of {weekOf}</p>
        )}
      </div>
      <div className="mb-4">
        <StatusBadge status={deadlinePassed ? 'research' : (statusMap[window_] || 'research')} />
      </div>
      <div className="space-y-3 text-sm">
        {days !== null && !deadlinePassed && (
          <div className="flex justify-between">
            <span className="text-text-muted">Days until deadline</span>
            <span className="font-mono text-text-warm">{days > 0 ? days : 'Today'}</span>
          </div>
        )}
        {nextDeadline && (
          <div className="flex justify-between">
            <span className="text-text-muted">
              {deadlinePassed ? 'Next deadline' : 'Deadline'}
            </span>
            <span className="font-mono text-text-warm text-xs">
              {formatDeadline(nextDeadline.toISOString().slice(0, 10))}
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
        {deadlinePassed && (
          <div className="flex justify-between">
            <span className="text-text-muted">Edition {toRoman(currentEdition)} deadline</span>
            <span className="font-mono text-success-dark text-xs">Passed</span>
          </div>
        )}
      </div>
      <div className="mt-6">
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span>Research</span><span>Drafting</span><span>Ready</span><span>Done</span>
        </div>
        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-500"
            style={{
              width: deadlinePassed ? '0%'
                : window_ === 'research' ? '25%'
                : window_ === 'drafting' ? '50%'
                : '75%'
            }}
          />
        </div>
      </div>
    </div>
  )
}
