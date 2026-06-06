import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const EDITION_CACHE_KEY = 'herald_current_edition'

export function computeCurrentEdition(): number {
  if (typeof window === 'undefined') return 0
  const cached = Number(window.localStorage.getItem(EDITION_CACHE_KEY))
  return Number.isFinite(cached) ? cached : 0
}

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
    let active = true

    async function fetchState() {
      const [psRes, issueRes] = await Promise.all([
        supabase
          .from('pipeline_state')
          .select('key, value')
          .in('key', ['current_edition_number', 'next_publish_date', 'edition_locked_after']),
        supabase
          .from('newsletter_issues')
          .select('edition_date, week_start, created_at')
          .in('status', ['draft', 'approved', 'published'])
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      const ps = psRes.data || []
      const latestIssue = issueRes.data?.[0] || null
      const currentEdition = Number(
        ps.find((row: { key: string; value: string }) => row.key === 'current_edition_number')?.value
      )

      if (!active) return
      if (Number.isFinite(currentEdition)) {
        window.localStorage.setItem(EDITION_CACHE_KEY, String(currentEdition))
      }
      setState({
        currentEdition: Number.isFinite(currentEdition) ? currentEdition : 0,
        editionDate: latestIssue?.edition_date || latestIssue?.week_start || null,
        nextPublishDate: ps.find((row: { key: string; value: string }) => row.key === 'next_publish_date')?.value || null,
        editionLockedAfter: ps.find((row: { key: string; value: string }) => row.key === 'edition_locked_after')?.value || null,
        lastDraftDate: latestIssue?.created_at || null,
        loading: false,
      })
    }

    fetchState()
    const channel = supabase
      .channel('edition-state')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pipeline_state' },
        (payload) => {
          const row = payload.new as { key?: string }
          if (['current_edition_number', 'next_publish_date', 'edition_locked_after'].includes(row.key || '')) {
            fetchState()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'newsletter_issues' },
        () => fetchState()
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  return state
}
