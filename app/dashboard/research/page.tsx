'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ContentItem } from '@/types/herald'

const SOURCE_TYPES = ['All', 'tiktok', 'youtube', 'twitter', 'rss', 'website', 'telegram_tip']

const sourceColors: Record<string, string> = {
  tiktok: 'text-pink-800 border-pink-900',
  youtube: 'text-red-900 border-red-950',
  twitter: 'text-blue-900 border-blue-950',
  rss: 'text-gold-muted border-border-gold',
  website: 'text-text-secondary border-border-dark',
  telegram_tip: 'text-text-secondary border-border-dark',
}

const PAGE_SIZE = 20

export default function ResearchPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceType, setSourceType] = useState('All')
  const [page, setPage] = useState(0)

  useEffect(() => { load() }, [sourceType, page])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('content_items')
      .select('*')
      .order('scraped_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (sourceType !== 'All') query = query.eq('source_type', sourceType)
    const { data } = await query
    if (data) setItems(data as ContentItem[])
    setLoading(false)
  }

  async function handleSearch() {
    if (!search.trim()) { load(); return }
    setLoading(true)
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .ilike('raw_text', `%${search}%`)
      .order('scraped_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (data) setItems(data as ContentItem[])
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-xl md:text-3xl text-text-warm">Research Database</h1>
        <div className="gold-divider mt-3" />
      </div>
      <div className="flex flex-col gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search content..."
          className="w-full bg-bg-elevated border border-border-dark rounded px-4 py-2.5 text-text-warm text-sm focus:outline-none focus:border-gold-muted min-h-[44px]"
        />
        <div className="flex gap-2 flex-wrap">
          {SOURCE_TYPES.map(t => (
            <button
              key={t}
              onClick={() => { setSourceType(t); setPage(0) }}
              className={`px-3 py-2 rounded text-xs tracking-wide border transition-all min-h-[44px] ${
                sourceType === t
                  ? 'border-gold text-gold bg-gold/5'
                  : 'border-border-dark text-text-muted hover:border-gold-muted hover:text-text-secondary'
              }`}
            >
              {t === 'All' ? 'All Sources' : t}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-bg-elevated rounded w-1/4 mb-2" />
              <div className="h-4 bg-bg-elevated rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="card p-4 hover:border hover:border-border-gold transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs border px-1.5 py-0.5 rounded ${sourceColors[item.source_type] || 'text-text-muted border-border-dark'}`}>
                        {item.source_type}
                      </span>
                      <span className="text-text-muted text-xs">{item.source_name}</span>
                      {item.is_deal_signal && (
                        <span className="text-xs border border-gold-muted text-gold px-1.5 py-0.5 rounded">DEAL</span>
                      )}
                      {item.is_voice_sample && (
                        <span className="text-xs border border-border-dark text-text-muted px-1.5 py-0.5 rounded">VOICE</span>
                      )}
                    </div>
                    <p className="text-text-secondary text-sm line-clamp-2">
                      {item.title || item.raw_text.slice(0, 150)}
                    </p>
                    {item.topics && item.topics.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {item.topics.slice(0, 4).map(topic => (
                          <span key={topic} className="text-xs text-text-muted border border-border-dark px-1.5 py-0.5 rounded">
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-text-muted text-xs font-mono flex-shrink-0">
                    {new Date(item.scraped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="border border-border-dark text-text-secondary px-4 py-2 rounded text-xs tracking-widest uppercase disabled:opacity-30 hover:border-gold-muted hover:text-gold transition-all"
            >
              Previous
            </button>
            <span className="text-text-muted text-xs self-center font-mono">Page {page + 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={items.length < PAGE_SIZE}
              className="border border-border-dark text-text-secondary px-4 py-2 rounded text-xs tracking-widest uppercase disabled:opacity-30 hover:border-gold-muted hover:text-gold transition-all"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
