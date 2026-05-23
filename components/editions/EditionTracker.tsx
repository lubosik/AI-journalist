'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface ContentItem {
  id: string
  edition_number: number
  content_type: string
  title: string
  body: string
  source_url?: string
  source_type?: string
  source_name?: string
  tags: string[]
  priority: number
  included_in_draft: boolean
  removed: boolean
  removed_at?: string
  removed_reason?: string
  added_by: string
  created_at: string
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  topic:            { label: 'Topic',         color: 'text-gold border-gold-muted' },
  research:         { label: 'Research',       color: 'text-blue-400 border-blue-800' },
  url_ingested:     { label: 'URL',            color: 'text-teal-400 border-teal-800' },
  dom_instruction:  { label: 'Instruction',    color: 'text-text-warm border-border-dark' },
  headline:         { label: 'Headline',       color: 'text-gold border-gold' },
  deal:             { label: 'Deal',           color: 'text-green-400 border-green-800' },
  draft_edit:       { label: 'Draft Edit',     color: 'text-orange-400 border-orange-800' },
  feedback_applied: { label: 'Feedback',       color: 'text-purple-400 border-purple-800' },
  voice_note:       { label: 'Voice Note',     color: 'text-sky-400 border-sky-800' },
  telegram_tip:     { label: 'Tip',            color: 'text-gold-muted border-gold-muted' },
}

const SECTION_ORDER = [
  'headline', 'dom_instruction', 'topic', 'deal', 'research',
  'url_ingested', 'draft_edit', 'voice_note', 'feedback_applied', 'telegram_tip',
]

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] || { label: type, color: 'text-text-muted border-border-dark' }
  return (
    <span className={`inline-block text-[10px] tracking-widest uppercase border px-1.5 py-0.5 rounded ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

interface ItemCardProps {
  item: ContentItem
  onRemove: (id: string) => void
  onRestore: (id: string) => void
  showRemoved: boolean
}

function ItemCard({ item, onRemove, onRestore, showRemoved }: ItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  const body = item.body || ''
  const truncated = body.length > 120 && !expanded ? body.slice(0, 120) + '…' : body

  if (item.removed && !showRemoved) return null

  return (
    <div className={`border rounded p-3 space-y-1.5 text-sm transition-all ${
      item.removed
        ? 'border-border-dark bg-bg-primary opacity-50'
        : 'border-border-dark bg-bg-elevated hover:border-gold-muted'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={item.content_type} />
          {item.included_in_draft && (
            <span className="text-[10px] tracking-widest uppercase bg-green-900/40 text-green-400 border border-green-800 px-1.5 py-0.5 rounded">
              In Draft
            </span>
          )}
          {item.removed && (
            <span className="text-[10px] tracking-widest uppercase text-red-700 border border-red-900 px-1.5 py-0.5 rounded">
              Removed
            </span>
          )}
        </div>
        <button
          onClick={() => item.removed ? onRestore(item.id) : onRemove(item.id)}
          className={`text-[10px] tracking-widest uppercase px-3 py-2 rounded border transition-all shrink-0 min-h-[44px] min-w-[60px] flex items-center justify-center ${
            item.removed
              ? 'border-gold-muted text-gold-muted hover:border-gold hover:text-gold'
              : 'border-red-900 text-red-700 hover:bg-red-900 hover:text-red-300'
          }`}
        >
          {item.removed ? 'Restore' : 'Remove'}
        </button>
      </div>

      {item.title && item.title !== body && (
        <p className="text-text-warm font-medium text-sm">{item.title}</p>
      )}

      <p className="text-text-secondary text-xs leading-relaxed">
        {truncated}
        {body.length > 120 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-gold-muted hover:text-gold ml-1 text-[10px] uppercase tracking-wider"
          >
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </p>

      {item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-gold-muted hover:text-gold underline break-all block"
        >
          {item.source_url}
        </a>
      )}

      <div className="flex items-center gap-3 pt-0.5">
        <span className="text-[10px] text-text-muted font-mono">{formatTime(item.created_at)}</span>
        <span className="text-[10px] text-text-muted border border-border-dark px-1.5 py-0.5 rounded">
          {item.added_by}
        </span>
      </div>
    </div>
  )
}

interface CollapsibleSectionProps {
  type: string
  items: ContentItem[]
  onRemove: (id: string) => void
  onRestore: (id: string) => void
  showRemoved: boolean
}

function CollapsibleSection({ type, items, onRemove, onRestore, showRemoved }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(true)
  const cfg = TYPE_CONFIG[type] || { label: type, color: 'text-text-muted border-border-dark' }
  const visible = showRemoved ? items : items.filter(i => !i.removed)
  if (visible.length === 0) return null

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded transition-all group"
      >
        <div className="flex items-center gap-2">
          <span className={`font-serif text-sm tracking-wide ${cfg.color.split(' ')[0]}`}>{cfg.label}</span>
          <span className="text-[10px] text-text-muted border border-border-dark px-1.5 py-0.5 rounded font-mono">
            {visible.length}
          </span>
        </div>
        <span className="text-text-muted text-xs group-hover:text-text-secondary transition-colors">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="space-y-2 mt-2">
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onRemove={onRemove}
              onRestore={onRestore}
              showRemoved={showRemoved}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface AddTopicFormProps {
  onSubmit: (topic: string, type: string) => Promise<void>
  onCancel: () => void
  submitting: boolean
}

function AddTopicForm({ onSubmit, onCancel, submitting }: AddTopicFormProps) {
  const [topic, setTopic] = useState('')
  const [topicType, setTopicType] = useState('topic')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    await onSubmit(topic.trim(), topicType)
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3 border border-gold-muted">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gold font-serif text-sm">Add Content</span>
      </div>
      <textarea
        className="w-full bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary text-sm font-mono focus:outline-none focus:border-gold-muted resize-none transition-colors"
        rows={3}
        placeholder="Describe the topic, instruction, or content to add..."
        value={topic}
        onChange={e => setTopic(e.target.value)}
        autoFocus
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <select
          value={topicType}
          onChange={e => setTopicType(e.target.value)}
          className="bg-bg-elevated border border-border-dark rounded px-2 py-2.5 text-text-secondary text-xs focus:outline-none focus:border-gold-muted min-h-[44px]"
        >
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none border border-border-dark text-text-muted px-3 py-2.5 rounded text-xs tracking-widest uppercase hover:border-gold-muted transition-all min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !topic.trim()}
            className="flex-1 sm:flex-none bg-gold text-bg-primary px-4 py-2.5 rounded text-xs tracking-widest uppercase hover:bg-gold-light transition-all disabled:opacity-40 min-h-[44px]"
          >
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function EditionTracker({
  issueId,
  editionNumber,
}: {
  issueId?: string
  editionNumber: number
}) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showRemoved, setShowRemoved] = useState(false)
  const [view, setView] = useState<'grouped' | 'timeline'>('grouped')
  const [addingTopic, setAddingTopic] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)

  // Fetch on mount and when showRemoved / editionNumber changes
  useEffect(() => {
    setLoading(true)
    if (issueId) {
      fetch(`/api/editions/${issueId}/content?include_removed=${showRemoved}`)
        .then(r => r.json())
        .then(data => {
          if (data.all) setItems(data.all as ContentItem[])
          setLoading(false)
        })
        .catch(() => { toast.error('Failed to load content'); setLoading(false) })
    } else {
      // No issue yet — load directly from edition_content by edition_number
      let query = supabase
        .from('edition_content')
        .select('*')
        .eq('edition_number', editionNumber)
        .order('created_at', { ascending: true })
      if (!showRemoved) {
        query = query.eq('removed', false)
      }
      query.then(({ data, error }) => {
        if (error) { toast.error('Failed to load content'); setLoading(false); return }
        setItems((data || []) as ContentItem[])
        setLoading(false)
      })
    }
  }, [issueId, editionNumber, showRemoved])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`edition-content-${editionNumber}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'edition_content',
        filter: `edition_number=eq.${editionNumber}`,
      }, (payload) => {
        setItems(prev => [...prev, payload.new as ContentItem])
        toast.success(`New: ${(payload.new as ContentItem).title || (payload.new as ContentItem).content_type}`)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'edition_content',
        filter: `edition_number=eq.${editionNumber}`,
      }, (payload) => {
        setItems(prev => prev.map(i =>
          i.id === (payload.new as ContentItem).id ? payload.new as ContentItem : i
        ))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [editionNumber])

  const handleRemove = async (contentId: string) => {
    // Optimistic update
    setItems(prev => prev.map(i => i.id === contentId ? { ...i, removed: true, removed_at: new Date().toISOString() } : i))
    try {
      if (issueId) {
        const res = await fetch(`/api/editions/${issueId}/content`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_id: contentId }),
        })
        if (!res.ok) {
          setItems(prev => prev.map(i => i.id === contentId ? { ...i, removed: false, removed_at: undefined } : i))
          toast.error('Failed to remove item')
          return
        }
      } else {
        const { error } = await supabase
          .from('edition_content')
          .update({ removed: true, removed_at: new Date().toISOString(), removed_reason: 'Removed from dashboard' })
          .eq('id', contentId)
        if (error) {
          setItems(prev => prev.map(i => i.id === contentId ? { ...i, removed: false, removed_at: undefined } : i))
          toast.error('Failed to remove item')
          return
        }
      }
      toast.success('Item removed')
    } catch {
      setItems(prev => prev.map(i => i.id === contentId ? { ...i, removed: false, removed_at: undefined } : i))
      toast.error('Failed to remove item')
    }
  }

  const handleRestore = async (contentId: string) => {
    // Optimistic update
    setItems(prev => prev.map(i => i.id === contentId ? { ...i, removed: false, removed_at: undefined } : i))
    try {
      const { error } = await supabase
        .from('edition_content')
        .update({ removed: false, removed_at: null, removed_reason: null })
        .eq('id', contentId)
      if (error) {
        setItems(prev => prev.map(i => i.id === contentId ? { ...i, removed: true } : i))
        toast.error('Failed to restore item')
      } else {
        toast.success('Item restored')
      }
    } catch {
      setItems(prev => prev.map(i => i.id === contentId ? { ...i, removed: true } : i))
      toast.error('Failed to restore item')
    }
  }

  const triggerRebuild = () => {
    if (!issueId) return
    fetch(`/api/editions/${issueId}/rebuild-html`, { method: 'POST' }).catch(() => {})
  }

  const handleRebuild = async () => {
    if (!issueId) return
    setRebuilding(true)
    try {
      const res = await fetch(`/api/editions/${issueId}/rebuild-html`, { method: 'POST' })
      if (res.ok) {
        toast.success('Rebuild queued — check Telegram in ~30s')
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(`Rebuild failed: ${body.error ?? res.status}`)
      }
    } catch {
      toast.error('Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  const handleAddTopic = async (topic: string, topicType: string) => {
    setSubmitting(true)
    try {
      if (issueId) {
        const res = await fetch(`/api/editions/${issueId}/content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, topic_type: topicType }),
        })
        if (!res.ok) {
          const json = await res.json()
          toast.error(json.error || 'Failed to add topic')
          return
        }
        toast.success('Topic added')
        setAddingTopic(false)
        // Fire-and-forget rebuild
        triggerRebuild()
        // Realtime will push the new item; if not, re-fetch
        setTimeout(() => {
          fetch(`/api/editions/${issueId}/content?include_removed=${showRemoved}`)
            .then(r => r.json())
            .then(data => { if (data.all) setItems(data.all as ContentItem[]) })
            .catch(() => {})
        }, 800)
      } else {
        // No issue yet — write directly to edition_content via Supabase
        const { data: week } = await supabase
          .from('edition_weeks')
          .select('week_start, week_end')
          .eq('edition_number', editionNumber)
          .single()
        const { error } = await supabase.from('edition_content').insert({
          edition_number: editionNumber,
          week_start: week?.week_start || new Date().toISOString().split('T')[0],
          week_end: week?.week_end || new Date().toISOString().split('T')[0],
          content_type: topicType || 'topic',
          title: topic.substring(0, 100),
          body: topic,
          priority: 5,
          added_by: 'dashboard',
        })
        if (error) {
          toast.error('Failed to add topic')
          return
        }
        toast.success('Topic added')
        setAddingTopic(false)
        // Re-fetch
        const query = showRemoved
          ? supabase.from('edition_content').select('*').eq('edition_number', editionNumber).order('created_at', { ascending: true })
          : supabase.from('edition_content').select('*').eq('edition_number', editionNumber).eq('removed', false).order('created_at', { ascending: true })
        query.then(({ data }) => { if (data) setItems(data as ContentItem[]) })
      }
    } catch {
      toast.error('Failed to add topic')
    } finally {
      setSubmitting(false)
    }
  }

  // Build grouped map in section order
  const grouped = SECTION_ORDER.reduce((acc, type) => {
    const typeItems = items.filter(i => i.content_type === type)
    if (typeItems.length > 0) acc[type] = typeItems
    return acc
  }, {} as Record<string, ContentItem[]>)

  // Include any types not in SECTION_ORDER
  items.forEach(item => {
    if (!SECTION_ORDER.includes(item.content_type) && !grouped[item.content_type]) {
      grouped[item.content_type] = []
    }
    if (!SECTION_ORDER.includes(item.content_type)) {
      if (!grouped[item.content_type]) grouped[item.content_type] = []
      if (!grouped[item.content_type].find(i => i.id === item.id)) {
        grouped[item.content_type].push(item)
      }
    }
  })

  const activeItems = items.filter(i => !i.removed)
  const timelineItems = (showRemoved ? items : activeItems).slice().sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-elevated rounded w-full" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4 h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View toggle */}
        <div className="flex border border-border-dark rounded overflow-hidden">
          {(['grouped', 'timeline'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 text-xs tracking-widest uppercase transition-all min-h-[44px] ${
                view === v
                  ? 'bg-gold text-bg-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Show removed toggle */}
        <button
          onClick={() => setShowRemoved(s => !s)}
          className={`px-3 py-2 text-xs tracking-widest uppercase rounded border transition-all min-h-[44px] ${
            showRemoved
              ? 'border-red-800 text-red-500 bg-red-900/20'
              : 'border-border-dark text-text-muted hover:border-gold-muted'
          }`}
        >
          {showRemoved ? 'Hide Removed' : 'Show Removed'}
        </button>

        {/* Rebuild draft */}
        {issueId && !addingTopic && (
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="px-3 py-2 text-xs tracking-widest uppercase rounded border border-border-dark text-text-muted hover:border-gold-muted hover:text-text-secondary transition-all min-h-[44px] disabled:opacity-40"
          >
            {rebuilding ? 'Rebuilding...' : 'Rebuild Draft'}
          </button>
        )}

        {/* Add topic */}
        {!addingTopic && (
          <button
            onClick={() => setAddingTopic(true)}
            className="px-3 py-2 text-xs tracking-widest uppercase rounded border border-gold-muted text-gold hover:bg-gold hover:text-bg-primary transition-all min-h-[44px]"
          >
            + Add
          </button>
        )}

        {/* Live indicator + stats — pushed to end */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[10px] text-text-muted font-mono hidden sm:inline">
            {activeItems.length} active / {items.length} total
          </span>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[10px] text-text-muted tracking-widest uppercase">Live</span>
          </div>
        </div>
      </div>

      {/* Add topic form */}
      {addingTopic && (
        <AddTopicForm
          onSubmit={handleAddTopic}
          onCancel={() => setAddingTopic(false)}
          submitting={submitting}
        />
      )}

      {/* GROUPED VIEW */}
      {view === 'grouped' && (
        <div>
          {Object.keys(grouped).length === 0 ? (
            <div className="card p-12 text-center text-text-muted">
              <p>No content for this edition yet.</p>
              <p className="text-xs mt-2">Content added via Telegram will appear here in real time.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([type, typeItems]) => (
              <CollapsibleSection
                key={type}
                type={type}
                items={typeItems}
                onRemove={handleRemove}
                onRestore={handleRestore}
                showRemoved={showRemoved}
              />
            ))
          )}
        </div>
      )}

      {/* TIMELINE VIEW */}
      {view === 'timeline' && (
        <div className="relative pl-6">
          {/* Left gold line */}
          <div className="absolute left-2 top-0 bottom-0 w-px bg-gold-muted opacity-30" />

          {timelineItems.length === 0 ? (
            <div className="card p-12 text-center text-text-muted">No items in timeline.</div>
          ) : (
            <div className="space-y-4">
              {timelineItems.map(item => (
                <div key={item.id} className={`relative ${item.removed ? 'opacity-40' : ''}`}>
                  {/* Timeline dot */}
                  <div className="absolute -left-4 top-2 w-2 h-2 rounded-full bg-gold-muted" />
                  <div className="border border-border-dark bg-bg-elevated rounded p-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-text-muted font-mono">{formatTime(item.created_at)}</span>
                      <TypeBadge type={item.content_type} />
                      {item.included_in_draft && (
                        <span className="text-[10px] uppercase tracking-widest text-green-400 border border-green-800 px-1.5 py-0.5 rounded">
                          In Draft
                        </span>
                      )}
                    </div>
                    <p className="text-text-secondary text-sm">{item.title || item.body.slice(0, 80)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
