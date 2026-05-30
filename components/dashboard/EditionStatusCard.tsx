'use client'
import { useState, useEffect } from 'react'
import { useEditionState } from '@/hooks/useEditionState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { supabase } from '@/lib/supabase'

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

function getDaysUntilTs(ts: Date): number {
  return Math.ceil((ts.getTime() - Date.now()) / 86400000)
}

// Format the lock timestamp as "Sunday, 24 May — 6:00 PM"
function formatDeadlineTs(ts: Date): string {
  const day = ts.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
    .replace('am', 'AM').replace('pm', 'PM')
  return `${day} — ${time}`
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
  const [draftConvState, setDraftConvState] = useState<string>('idle')

  useEffect(() => {
    supabase
      .from('pipeline_state')
      .select('value')
      .eq('key', 'draft_conversation_state')
      .single()
      .then(({ data }) => setDraftConvState(data?.value || 'idle'))

    const ch = supabase
      .channel('draft_conv_state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_state' }, (payload) => {
        const row = payload.new as Record<string, string>
        if (row?.key === 'draft_conversation_state') {
          setDraftConvState(row.value || 'idle')
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

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

  // Deadline passes at the edition lock time (6pm EST Sunday), not midnight.
  // Use editionLockedAfter if set; fall back to end-of-day on publish date.
  const lockTime = editionLockedAfter
    ? new Date(editionLockedAfter)
    : deadlineDate
      ? new Date(parseLocalDate(deadlineDate).getTime() + 23 * 3600 * 1000)
      : null
  const deadlinePassed = lockTime ? now > lockTime : false
  const displayEdition = deadlinePassed ? currentEdition + 1 : currentEdition

  // Current lock time — the actual Sunday 6pm deadline
  // When deadline passed, compute the NEXT Sunday 6pm by adding 7 days
  const currentLockTime = lockTime
  const nextLockTime: Date | null = (() => {
    if (!currentLockTime) return null
    if (deadlinePassed) {
      return new Date(currentLockTime.getTime() + 7 * 86400000)
    }
    return currentLockTime
  })()

  const days = nextLockTime ? getDaysUntilTs(nextLockTime) : null
  const window_ = getWindow(editionLockedAfter, deadlineDate)

  // Week of label: Sunday that starts the current edition's research week
  const weekOf = nextLockTime
    ? (() => {
        // The research week starts 7 days before the Sunday deadline
        const weekStart = new Date(nextLockTime.getTime() - 7 * 86400000)
        return weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
      })()
    : null

  const draftStateLabel: Record<string, string> = {
    idle: '',
    awaiting_approval: 'Awaiting Approval',
    in_revision: 'In Revision',
    approved: 'Approved',
    drafting: 'Drafting',
  }

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
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <StatusBadge status={deadlinePassed ? 'research' : (statusMap[window_] || 'research')} />
        {draftConvState && draftConvState !== 'idle' && (
          <span className="text-xs font-mono text-gold border border-gold-muted rounded px-2 py-0.5">
            {draftStateLabel[draftConvState] || draftConvState}
          </span>
        )}
      </div>
      <div className="space-y-3 text-sm">
        {days !== null && !deadlinePassed && (
          <div className="flex justify-between">
            <span className="text-text-muted">Days until deadline</span>
            <span className="font-mono text-text-warm">{days > 0 ? days : 'Today'}</span>
          </div>
        )}
        {nextLockTime && (
          <div className="flex justify-between gap-4">
            <span className="text-text-muted shrink-0">
              {deadlinePassed ? 'Next deadline' : 'Deadline'}
            </span>
            <span className="font-mono text-text-warm text-xs text-right">
              {formatDeadlineTs(nextLockTime)}
            </span>
          </div>
        )}
        {lastDraftDate && (
          <div className="flex justify-between">
            <span className="text-text-muted">Last draft</span>
            <span className="font-mono text-text-warm text-xs">
              {new Date(lastDraftDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}
        {deadlinePassed && (
          <div className="flex justify-between">
            <span className="text-text-muted">Edition {toRoman(currentEdition)}</span>
            <span className="font-mono text-success-dark text-xs">Deadline passed</span>
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
