'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function DraftApprovalBanner() {
  const [draftState, setDraftState] = useState<string>('idle')

  useEffect(() => {
    async function fetchState() {
      const { data } = await supabase
        .from('pipeline_state')
        .select('value')
        .eq('key', 'draft_conversation_state')
        .single()
      setDraftState(data?.value || 'idle')
    }
    fetchState()

    const channel = supabase
      .channel('draft_state_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_state' }, (payload) => {
        const row = payload.new as Record<string, string>
        if (row?.key === 'draft_conversation_state') {
          setDraftState(row.value || 'idle')
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (draftState === 'idle' || draftState === '') return null

  if (draftState === 'drafting') {
    return (
      <div className="mb-6 border border-gold-muted rounded p-4 bg-bg-elevated flex items-center gap-3">
        <span className="inline-block w-2 h-2 rounded-full bg-gold animate-pulse" />
        <span className="text-text-warm text-sm">Draft generation in progress...</span>
      </div>
    )
  }

  if (draftState === 'awaiting_approval' || draftState === 'in_revision') {
    return (
      <div className="mb-6 border border-gold rounded p-4 bg-bg-elevated">
        <div className="flex items-start gap-3">
          <span className="text-gold text-lg mt-0.5">!</span>
          <div>
            <p className="text-text-warm text-sm font-medium mb-1">
              HERALD has presented this week's topics for approval.
            </p>
            <p className="text-text-muted text-xs">
              Go to Telegram to approve or modify before the draft begins.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
