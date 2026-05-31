import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface EditionState {
  currentEdition: number
  editionDate: string | null
  nextPublishDate: string | null
  editionLockedAfter: string | null
  lastDraftDate: string | null
  loading: boolean
}

export function useEditionState() {
  const [state, setState] = useState<EditionState>({
    currentEdition: 0,
    editionDate: null,
    nextPublishDate: null,
    editionLockedAfter: null,
    lastDraftDate: null,
    loading: true,
  })

  useEffect(() => {
    async function fetch() {
      const [psRes, issueRes] = await Promise.all([
        supabase
          .from('pipeline_state')
          .select('key, value')
          .in('key', ['current_edition_number', 'next_publish_date', 'edition_locked_after']),
        supabase
          .from('newsletter_issues')
          .select('issue_number, edition_date, week_start, updated_at')
          .in('status', ['draft', 'approved', 'published'])
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      const ps = psRes.data || []
      const latestIssue = issueRes.data?.[0] || null

      // Prefer the live issue_number from newsletter_issues; fall back to
      // the pipeline_state key if no issue exists yet.
      const psEdition = parseInt(
        ps.find((r: { key: string; value: string }) => r.key === 'current_edition_number')?.value || '0'
      )
      const currentEdition = latestIssue?.issue_number
        ? parseInt(String(latestIssue.issue_number))
        : psEdition || 1

      // edition_date is the Sunday publish date; week_start is the Monday.
      // Use whichever is available to show the correct week label.
      const editionDate = latestIssue?.edition_date || latestIssue?.week_start || null

      setState({
        currentEdition,
        editionDate,
        nextPublishDate: ps.find((r: { key: string; value: string }) => r.key === 'next_publish_date')?.value || null,
        editionLockedAfter: ps.find((r: { key: string; value: string }) => r.key === 'edition_locked_after')?.value || null,
        lastDraftDate: latestIssue?.updated_at || null,
        loading: false,
      })
    }
    fetch()
  }, [])

  return state
}
