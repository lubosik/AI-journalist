import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface EditionState {
  currentEdition: number
  nextPublishDate: string | null
  editionLockedAfter: string | null
  loading: boolean
}

export function useEditionState() {
  const [state, setState] = useState<EditionState>({
    currentEdition: 0,
    nextPublishDate: null,
    editionLockedAfter: null,
    loading: true,
  })

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('pipeline_state')
        .select('key, value')
        .in('key', ['current_edition_number', 'next_publish_date', 'edition_locked_after'])
      if (data) {
        setState({
          currentEdition: parseInt(data.find((r: { key: string; value: string }) => r.key === 'current_edition_number')?.value || '0'),
          nextPublishDate: data.find((r: { key: string; value: string }) => r.key === 'next_publish_date')?.value || null,
          editionLockedAfter: data.find((r: { key: string; value: string }) => r.key === 'edition_locked_after')?.value || null,
          loading: false,
        })
      } else {
        setState(prev => ({ ...prev, loading: false }))
      }
    }
    fetch()
  }, [])

  return state
}
