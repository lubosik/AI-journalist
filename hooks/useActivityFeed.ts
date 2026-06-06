'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { ActivityEvent } from '@/types/herald'

function genId() { return Math.random().toString(36).substr(2, 9) }

export function useActivityFeed(limit = 50) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  // Unique channel name per hook instance prevents collision when multiple
  // components subscribe simultaneously (Sidebar + MobileNav + activity page)
  const channelName = useRef(`herald-activity-${genId()}`)

  const addEvent = useCallback((event: ActivityEvent) => {
    setEvents(prev => [event, ...prev].slice(0, 100))
  }, [])

  useEffect(() => {
    async function loadInitial() {
      try {
        const [contentRes, issueRes, briefRes, conversationRes, topicRes, triggerRes] = await Promise.all([
          supabase.from('content_items').select('id, title, source_name, source_type, scraped_at').order('scraped_at', { ascending: false }).limit(20),
          supabase.from('newsletter_issues').select('id, issue_number, status, created_at').order('created_at', { ascending: false }).limit(10),
          supabase.from('morning_brief_log').select('id, items_ingested, created_at').order('created_at', { ascending: false }).limit(10),
          supabase.from('conversation_memory').select('id, role, content, created_at').order('created_at', { ascending: false }).limit(10),
          supabase.from('edition_topics').select('id, topic, edition_number, created_at').order('created_at', { ascending: false }).limit(10),
          supabase.from('pipeline_triggers').select('id, trigger_type, status, created_at').order('created_at', { ascending: false }).limit(10),
        ])
        const initial: ActivityEvent[] = []
        for (const item of (contentRes.data || [])) {
          initial.push({ id: `content-${item.id}`, type: 'INGESTION', message: `Ingested: ${item.title || item.source_name}`, source: item.source_type, timestamp: item.scraped_at })
        }
        for (const issue of (issueRes.data || [])) {
          const type: ActivityEvent['type'] = issue.status === 'published' ? 'PUBLISHED' : issue.status === 'draft' ? 'DRAFT_READY' : 'DRAFT_START'
          initial.push({ id: `issue-${issue.id}`, type, message: `Edition ${issue.issue_number} - ${issue.status}`, timestamp: issue.created_at })
        }
        for (const brief of (briefRes.data || [])) {
          initial.push({ id: `brief-${brief.id}`, type: 'MORNING_BRIEF', message: `Morning brief sent - ${brief.items_ingested} new items`, timestamp: brief.created_at })
        }
        for (const message of (conversationRes.data || [])) {
          initial.push({ id: `conversation-${message.id}`, type: 'TELEGRAM_TIP', message: `${message.role === 'user' ? 'Dom' : 'HERALD'}: ${message.content.slice(0, 100)}`, timestamp: message.created_at })
        }
        for (const topic of (topicRes.data || [])) {
          initial.push({ id: `topic-${topic.id}`, type: 'RESEARCH', message: `Edition ${topic.edition_number} topic: ${topic.topic}`, timestamp: topic.created_at })
        }
        const HIDDEN_TRIGGERS = new Set(['health_check'])
        for (const trigger of (triggerRes.data || [])) {
          if (HIDDEN_TRIGGERS.has(trigger.trigger_type)) continue
          initial.push({ id: `trigger-${trigger.id}`, type: 'DRAFT_START', message: `${trigger.trigger_type.replace(/_/g, ' ')} - ${trigger.status}`, timestamp: trigger.created_at })
        }
        initial.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setEvents(initial.slice(0, limit))
      } catch (err) {
        console.error('[useActivityFeed] load error:', err)
      } finally { setLoading(false) }
    }
    loadInitial()

    const channel = supabase.channel(channelName.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'content_items' }, (payload) => {
        const item = payload.new as Record<string, unknown>
        addEvent({ id: genId(), type: 'INGESTION', message: `Ingested: ${(item.title as string) || (item.source_name as string) || 'new item'}`, source: item.source_type as string, timestamp: (item.scraped_at as string) || new Date().toISOString() })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_issues' }, (payload) => {
        const issue = payload.new as Record<string, unknown>
        if (!issue?.id) return
        const type: ActivityEvent['type'] = issue.status === 'published' ? 'PUBLISHED' : issue.status === 'draft' ? 'DRAFT_READY' : 'DRAFT_START'
        addEvent({ id: genId(), type, message: `Edition ${issue.issue_number as number} - ${issue.status as string}`, timestamp: (issue.updated_at as string) || (issue.created_at as string) || new Date().toISOString() })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_memory' }, (payload) => {
        const message = payload.new as Record<string, unknown>
        const content = String(message.content || '')
        addEvent({ id: genId(), type: 'TELEGRAM_TIP', message: `${message.role === 'user' ? 'Dom' : 'HERALD'}: ${content.slice(0, 100)}`, timestamp: (message.created_at as string) || new Date().toISOString() })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edition_topics' }, (payload) => {
        const topic = (payload.new || payload.old) as Record<string, unknown>
        addEvent({ id: genId(), type: 'RESEARCH', message: `Edition ${topic.edition_number as number} topic updated: ${String(topic.topic || 'topic')}`, timestamp: (topic.updated_at as string) || (topic.created_at as string) || new Date().toISOString() })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pipeline_state' }, (payload) => {
        const state = payload.new as Record<string, unknown>
        addEvent({ id: genId(), type: 'DRAFT_START', message: `Pipeline state: ${String(state.key || 'state')} updated`, timestamp: (state.updated_at as string) || new Date().toISOString() })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dom_profile' }, (payload) => {
        const memory = payload.new as Record<string, unknown>
        addEvent({ id: genId(), type: 'TELEGRAM_TIP', message: `Preference learned: ${String(memory.content || memory.memory_type || 'new preference').slice(0, 100)}`, timestamp: (memory.created_at as string) || new Date().toISOString() })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_triggers' }, (payload) => {
        const trigger = (payload.new || payload.old) as Record<string, unknown>
        if (String(trigger.trigger_type || '') === 'health_check') return
        addEvent({ id: genId(), type: 'DRAFT_START', message: `${String(trigger.trigger_type || 'pipeline action').replace(/_/g, ' ')} - ${String(trigger.status || payload.eventType).toLowerCase()}`, timestamp: (trigger.processed_at as string) || (trigger.created_at as string) || new Date().toISOString() })
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
