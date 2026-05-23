'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ActivityEvent } from '@/types/herald'

function genId() { return Math.random().toString(36).substr(2, 9) }

export function useActivityFeed(limit = 50) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  const addEvent = useCallback((event: ActivityEvent) => {
    setEvents(prev => [event, ...prev].slice(0, 100))
  }, [])

  useEffect(() => {
    async function loadInitial() {
      try {
        const [contentRes, issueRes, briefRes] = await Promise.all([
          supabase.from('content_items').select('id, title, source_name, source_type, scraped_at').order('scraped_at', { ascending: false }).limit(20),
          supabase.from('newsletter_issues').select('id, issue_number, status, created_at').order('created_at', { ascending: false }).limit(10),
          supabase.from('morning_brief_log').select('id, items_ingested, created_at').order('created_at', { ascending: false }).limit(10),
        ])
        const initial: ActivityEvent[] = []
        for (const item of (contentRes.data || [])) {
          initial.push({ id: item.id, type: 'INGESTION', message: `Ingested: ${item.title || item.source_name}`, source: item.source_type, timestamp: item.scraped_at })
        }
        for (const issue of (issueRes.data || [])) {
          const type: ActivityEvent['type'] = issue.status === 'published' ? 'PUBLISHED' : issue.status === 'draft' ? 'DRAFT_READY' : 'DRAFT_START'
          initial.push({ id: issue.id, type, message: `Edition ${issue.issue_number} - ${issue.status}`, timestamp: issue.created_at })
        }
        for (const brief of (briefRes.data || [])) {
          initial.push({ id: brief.id, type: 'MORNING_BRIEF', message: `Morning brief sent - ${brief.items_ingested} new items`, timestamp: brief.created_at })
        }
        initial.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setEvents(initial.slice(0, limit))
      } catch (err) {
        console.error('[useActivityFeed] load error:', err)
      } finally { setLoading(false) }
    }
    loadInitial()

    const channel = supabase.channel('herald-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'content_items' }, (payload) => {
        const item = payload.new as Record<string, unknown>
        addEvent({ id: genId(), type: 'INGESTION', message: `Ingested: ${(item.title as string) || (item.source_name as string) || 'new item'}`, source: item.source_type as string, timestamp: (item.scraped_at as string) || new Date().toISOString() })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'newsletter_issues' }, (payload) => {
        const issue = payload.new as Record<string, unknown>
        const type: ActivityEvent['type'] = issue.status === 'published' ? 'PUBLISHED' : issue.status === 'draft' ? 'DRAFT_READY' : 'DRAFT_START'
        addEvent({ id: genId(), type, message: `Edition ${issue.issue_number as number} - ${issue.status as string}`, timestamp: (issue.updated_at as string) || new Date().toISOString() })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'morning_brief_log' }, (payload) => {
        const brief = payload.new as Record<string, unknown>
        addEvent({ id: genId(), type: 'MORNING_BRIEF', message: `Morning brief sent - ${brief.items_ingested as number} new items`, timestamp: (brief.created_at as string) || new Date().toISOString() })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [addEvent, limit])

  return { events, loading }
}
