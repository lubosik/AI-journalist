import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Edition 1 deadline: Sunday 24 May 2026, 6 PM EDT = 22:00 UTC.
// Each subsequent Sunday's 6pm deadline = next edition.
export function computeCurrentEdition(): number {
  const edition1DeadlineMs = new Date('2026-05-24T22:00:00Z').getTime()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksPast = Math.floor((Date.now() - edition1DeadlineMs) / msPerWeek)
  return Math.max(1, weeksPast + 2)
}

export interface EditionState {
  currentEdition: number
  nextPublishDate: string | null
  editionLockedAfter: string | null
  lastDraftDate: string | null
  loading: boolean
}

export function useEditionState() {
  const [state, setState] = useState<EditionState>({
    currentEdition: 0,
    nextPublishDate: null,
    editionLockedAfter: null,
    lastDraftDate: null,
    loading: true,
  })

  useEffect(() => {
    async function fetch() {
      const [psRes, draftRes] = await Promise.all([
        supabase
          .from('pipeline_state')
          .select('key, value')
          .in('key', ['current_edition_number', 'next_publish_date', 'edition_locked_after']),
        supabase
          .from('newsletter_issues')
          .select('updated_at')
          .in('status', ['draft', 'approved', 'published'])
          .order('updated_at', { ascending: false })
          .limit(1),
      ])

      const ps = psRes.data || []
      const lastDraft = draftRes.data?.[0]?.updated_at || null

      setState({
        currentEdition: computeCurrentEdition(),
        nextPublishDate: ps.find((r: { key: string; value: string }) => r.key === 'next_publish_date')?.value || null,
        editionLockedAfter: ps.find((r: { key: string; value: string }) => r.key === 'edition_locked_after')?.value || null,
        lastDraftDate: lastDraft,
        loading: false,
      })
    }
    fetch()
  }, [])

  return state
}
