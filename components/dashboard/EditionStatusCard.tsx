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

/**
 * Compute the canonical deadline for a given base date: the Sunday of that week at 6pm EST.
 * If the current time is already past that Sunday 6pm EST, returns the NEXT Sunday 6pm EST.
 */
function getNextDeadline(): Date {
  // Get current time in EST
  const nowEst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const dow = nowEst.getDay() // 0 = Sunday
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow

  const candidate = new Date(nowEst)
  candidate.setDate(candidate.getDate() + daysUntilSunday)
  candidate.setHours(18, 0, 0, 0) // 6pm

  // If we're already past this Sunday's 6pm, move to next Sunday
  if (candidate <= nowEst) {
    candidate.setDate(candidate.getDate() + 7)
  }

  // Convert back from EST to UTC for comparison against Date.now()
  const estOffset = new Date().getTime() - new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime()
  return new Date(candidate.getTime() + estOffset)
}

function getDaysUntilTs(ts: Date): number {
  return Math.ceil((ts.getTime() - Date.now()) / 86400000)
}

// Format the deadline as "Sunday, 25 May — 6:00 PM EST"
function formatDeadlineTs(ts: Date): string {
  return ts.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/New_York',
  }) + ' — 6:00 PM EST'
}

function getWindow(nextDeadline: Date): string {
  const now = new Date()
  const msUntil = nextDeadline.getTime() - now.getTime()
  const daysUntil = msUntil / 86400000
  // Drafting window: last 2 days before deadline (Friday 6pm → Sunday 6pm)
  if (daysUntil <= 2) return 'drafting'
  return 'research'
}

export function EditionStatusCard() {
  const { currentEdition, lastDraftDate, loading } = useEditionState()
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

  const nextDeadline = getNextDeadline()
  const days = getDaysUntilTs(nextDeadline)
  const window_ = getWindow(nextDeadline)

  // Week of label: Sunday that starts the current research week
  const weekStart = new Date(nextDeadline.getTime() - 7 * 86400000)
  const weekOf = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  const statusMap: Record<string, string> = {
    research: 'research',
    drafting: 'drafting',
  }

  const draftStateLabel: Record<string, string> = {
    awaiting_approval: 'Awaiting Approval',
    in_revision: 'In Revision',
    approved: 'Approved',
    drafting: 'Drafting',
  }

  return (
    <div className="card p-6">
      <div className="mb-6">
        <p className="text-text-muted text-xs tracking-widest uppercase mb-1">Current Edition</p>
        <h2 className="font-serif text-5xl text-gold">EDITION {toRoman(currentEdition || 1)}</h2>
        <p className="text-text-muted text-xs mt-2">Week of {weekOf}</p>
      </div>
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <StatusBadge status={statusMap[window_] || 'research'} />
        {draftConvState && draftConvState !== 'idle' && draftStateLabel[draftConvState] && (
          <span className="text-xs font-mono text-gold border border-gold-muted rounded px-2 py-0.5">
            {draftStateLabel[draftConvState]}
          </span>
        )}
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Days until deadline</span>
          <span className="font-mono text-text-warm">{days > 0 ? days : 'Today'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-text-muted shrink-0">Deadline</span>
          <span className="font-mono text-text-warm text-xs text-right">
            {formatDeadlineTs(nextDeadline)}
          </span>
        </div>
        {lastDraftDate && (
          <div className="flex justify-between">
            <span className="text-text-muted">Last draft generated</span>
            <span className="font-mono text-text-warm text-xs">
              {new Date(lastDraftDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
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
              width: window_ === 'research' ? '25%' : '50%'
            }}
          />
        </div>
      </div>
    </div>
  )
}
