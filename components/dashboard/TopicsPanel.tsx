'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Topic {
  id: string
  topic: string
  topic_type: string
  priority: number
  source: string
  added_by: string
  created_at: string
}

export function TopicsPanel() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [editionNumber, setEditionNumber] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [newTopic, setNewTopic] = useState('')
  const [topicType, setTopicType] = useState('topic')
  const [saving, setSaving] = useState(false)

  const fetchTopics = useCallback(async () => {
    const res = await fetch('/api/editions/current/topics')
    if (res.ok) {
      const data = await res.json()
      setTopics(data.topics || [])
      setEditionNumber(data.edition_number || 0)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTopics()

    // Subscribe to real-time changes on edition_topics
    const channel = supabase
      .channel('edition_topics_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'edition_topics',
      }, () => {
        fetchTopics()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchTopics])

  const addTopic = async () => {
    if (!newTopic.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/editions/current/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newTopic.trim(), topic_type: topicType }),
      })
      if (res.ok) {
        setNewTopic('')
        fetchTopics()
      }
    } finally {
      setSaving(false)
    }
  }

  const removeTopic = async (id: string) => {
    await fetch(`/api/editions/current/topics?id=${id}`, { method: 'DELETE' })
    setTopics(prev => prev.filter(t => t.id !== id))
  }

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      topic: '',
      deal: 'DEAL',
      headline: 'HEADLINE',
      dom_instruction: 'INSTRUCTION',
    }
    return labels[type] || type.toUpperCase()
  }

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-4 bg-bg-elevated rounded w-1/2 mb-4" />
        <div className="h-3 bg-bg-elevated rounded mb-2" />
        <div className="h-3 bg-bg-elevated rounded w-3/4" />
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg text-text-warm">
          Edition {editionNumber} Topics
        </h3>
        <span className="text-xs text-text-muted font-mono">{topics.length} saved</span>
      </div>

      {topics.length === 0 ? (
        <p className="text-text-muted text-sm mb-4">
          No topics saved yet. Add via Telegram or below.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {topics.map((t) => (
            <li key={t.id} className="flex items-start gap-2 group">
              <span className="flex-1 text-sm text-text-secondary leading-snug">
                {typeLabel(t.topic_type) && (
                  <span className="text-gold text-xs font-mono mr-1">
                    [{typeLabel(t.topic_type)}]
                  </span>
                )}
                {t.topic}
              </span>
              <button
                onClick={() => removeTopic(t.id)}
                className="text-text-muted hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                title="Remove"
              >
                x
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border-dark pt-4 space-y-2">
        <input
          type="text"
          value={newTopic}
          onChange={e => setNewTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTopic()}
          placeholder="Add a topic..."
          className="w-full bg-bg-elevated border border-border-dark text-text-primary text-sm px-3 py-2 rounded focus:outline-none focus:border-gold-muted placeholder:text-text-muted"
        />
        <div className="flex gap-2">
          <select
            value={topicType}
            onChange={e => setTopicType(e.target.value)}
            className="bg-bg-elevated border border-border-dark text-text-secondary text-xs px-2 py-2 rounded focus:outline-none"
          >
            <option value="topic">Topic</option>
            <option value="deal">Deal</option>
            <option value="headline">Headline</option>
            <option value="dom_instruction">Instruction</option>
          </select>
          <button
            onClick={addTopic}
            disabled={saving || !newTopic.trim()}
            className="flex-1 text-xs border border-gold-muted text-gold py-2 rounded tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all duration-300 disabled:opacity-40"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
