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

function getDaysUntilTs(ts: Date): number {
  return Math.max(0, Math.ceil((ts.getTime() - Date.now()) / 86400000))
}

function parsePipelineDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00-04:00`)
  }
  return new Date(value)
}

function formatDeadlineTs(ts: Date): string {
  return ts.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/New_York',
  })
}

function getWindow(publishDate: Date, lockedAfter: string | null): string {
  if (lockedAfter && Date.now() >= new Date(lockedAfter).getTime()) return 'drafting'
  if (publishDate.getTime() <= Date.now()) return 'drafting'
  return 'research'
}

export function EditionStatusCard() {
  const { currentEdition, nextPublishDate, editionLockedAfter, lastDraftDate, loading } = useEditionState()
  const [draftConvState, setDraftConvState] = useState<string>('idle')

  useEffect(() => {
    supabase.from('pipeline_state').select('value').eq('key', 'draft_conversation_state').single()
      .then(({ data }) => setDraftConvState(data?.value || 'idle'))
    const ch = supabase.channel('draft_conv_state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_state' }, (payload) => {
        const row = payload.new as Record<string, string>
        if (row?.key === 'draft_conversation_state') setDraftConvState(row.value || 'idle')
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

  const publishDate = nextPublishDate ? parsePipelineDate(nextPublishDate) : null
  const validPublishDate = publishDate && !Number.isNaN(publishDate.getTime()) ? publishDate : null
  const days = validPublishDate ? getDaysUntilTs(validPublishDate) : null
  const window_ = validPublishDate ? getWindow(validPublishDate, editionLockedAfter) : 'research'

  const statusMap: Record<string, string> = {
    research: 'research',
    drafting: 'drafting',
  }

  return (
    <div className="card p-6">
      <div className="mb-6">
        <p className="text-text-muted text-xs tracking-widest uppercase mb-1">Current Edition</p>
        <h2 className="font-serif text-5xl text-gold">EDITION {toRoman(currentEdition || 1)}</h2>
        <p className="text-text-muted text-xs mt-2">
          {validPublishDate ? `Publishes ${formatDeadlineTs(validPublishDate)}` : 'Publish date not configured'}
        </p>
      </div>
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <StatusBadge status={statusMap[window_] || 'research'} />
        {draftConvState && draftConvState !== 'idle' && (['awaiting_approval','in_revision','approved','drafting'].includes(draftConvState)) && (
          <span className="text-xs font-mono text-gold border border-gold-muted rounded px-2 py-0.5">
            {draftConvState.replace(/_/g, ' ')}
          </span>
        )}
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Days until deadline</span>
          <span className="font-mono text-text-warm">
            {days === null ? 'Not set' : days > 0 ? days : 'Today'}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-text-muted shrink-0">Deadline</span>
          <span className="font-mono text-text-warm text-xs text-right">
            {validPublishDate ? formatDeadlineTs(validPublishDate) : 'Not set'}
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
