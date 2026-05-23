'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'

const EditionTracker = dynamic(() => import('@/components/editions/EditionTracker'), { ssr: false })

interface EditionWeek {
  edition_number: number
  week_start: string
  week_end: string
}

interface EditionWithCount extends EditionWeek {
  item_count: number
}

interface IssueIdMap {
  [edition_number: number]: string
}

interface SearchResult {
  id: string
  edition_number: number
  content_type: string
  title: string
  body: string
  created_at: string
}

export default function TrackerPage() {
  const [editions, setEditions] = useState<EditionWithCount[]>([])
  const [issueIds, setIssueIds] = useState<IssueIdMap>({})
  const [selectedEdition, setSelectedEdition] = useState<number | null>(null)
  const [loadingEditions, setLoadingEditions] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('edition_weeks')
        .select('edition_number, week_start, week_end')
        .order('edition_number', { ascending: false }),
      supabase
        .from('edition_content')
        .select('edition_number')
        .eq('removed', false),
      supabase
        .from('newsletter_issues')
        .select('id, issue_number'),
    ]).then(([weeksRes, contentRes, issuesRes]) => {
      if (weeksRes.error) toast.error('Failed to load editions')

      const weeks = (weeksRes.data || []) as EditionWeek[]
      const contentRows = (contentRes.data || []) as { edition_number: number }[]
      const issues = (issuesRes.data || []) as { id: string; issue_number: number }[]

      // Count items per edition
      const countMap: Record<number, number> = {}
      contentRows.forEach(row => {
        countMap[row.edition_number] = (countMap[row.edition_number] || 0) + 1
      })

      // Build issue id map
      const idMap: IssueIdMap = {}
      issues.forEach(issue => { idMap[issue.issue_number] = issue.id })
      setIssueIds(idMap)

      const withCounts: EditionWithCount[] = weeks.map(w => ({
        ...w,
        item_count: countMap[w.edition_number] || 0,
      }))
      setEditions(withCounts)

      // Auto-select the most recent edition
      if (withCounts.length > 0) setSelectedEdition(withCounts[0].edition_number)

      setLoadingEditions(false)
    })
  }, [])

  // Search across all editions
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timeout = setTimeout(() => {
      setSearching(true)
      supabase
        .from('edition_content')
        .select('id, edition_number, content_type, title, body, created_at')
        .ilike('body', `%${searchQuery}%`)
        .eq('removed', false)
        .order('edition_number', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setSearchResults((data || []) as SearchResult[])
          setSearching(false)
        })
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const selectedIssueId = selectedEdition ? issueIds[selectedEdition] : undefined

  function formatWeek(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function formatEditionRange(weekStart: string, weekEnd: string) {
    const [sy, sm, sd] = weekStart.split('-').map(Number)
    const [ey, em, ed] = weekEnd.split('-').map(Number)
    const startDate = new Date(sy, sm - 1, sd)
    // publish date is week_end + 1 day
    const endDate = new Date(ey, em - 1, ed + 1)
    const startStr = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const endStr = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return `${startStr}–${endStr}`
  }

  const selectedEditionData = editions.find(e => e.edition_number === selectedEdition)

  return (
    <div>
      {/* Mobile edition selector */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="w-full flex items-center justify-between border border-border-dark rounded px-4 py-3 text-text-secondary text-sm hover:border-gold-muted transition-all min-h-[48px]"
        >
          <span>
            {selectedEditionData
              ? `Edition ${selectedEditionData.edition_number} — ${formatEditionRange(selectedEditionData.week_start, selectedEditionData.week_end)}`
              : 'Select Edition'}
          </span>
          <span className="text-text-muted text-xs ml-2">{sidebarOpen ? '▲' : '▼'}</span>
        </button>

        {sidebarOpen && (
          <div className="border border-border-dark rounded mt-1 bg-bg-secondary max-h-64 overflow-y-auto">
            {loadingEditions ? (
              <div className="space-y-2 p-3 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-bg-elevated rounded" />
                ))}
              </div>
            ) : editions.length === 0 ? (
              <p className="text-text-muted text-xs p-3">No editions found.</p>
            ) : (
              editions.map(ed => {
                const isActive = selectedEdition === ed.edition_number
                return (
                  <button
                    key={ed.edition_number}
                    onClick={() => { setSelectedEdition(ed.edition_number); setSidebarOpen(false) }}
                    className={`w-full text-left px-4 py-3 border-b border-border-dark last:border-b-0 transition-all min-h-[48px] ${
                      isActive
                        ? 'text-gold bg-gold/5'
                        : 'text-text-secondary hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Edition {ed.edition_number}</span>
                      {ed.item_count > 0 && (
                        <span className="text-[10px] font-mono text-text-muted border border-border-dark px-1.5 py-0.5 rounded">
                          {ed.item_count}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Week of {formatWeek(ed.week_start)}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="flex gap-0 min-h-[80vh]">
        {/* Sidebar — desktop only */}
        <div className="hidden md:block w-64 shrink-0 border-r border-border-dark pr-4 space-y-1">
          <h2 className="font-serif text-lg text-text-warm mb-4">Editions</h2>
          {loadingEditions ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-bg-elevated rounded" />
              ))}
            </div>
          ) : editions.length === 0 ? (
            <p className="text-text-muted text-xs">No editions found.</p>
          ) : (
            editions.map(ed => {
              const isActive = selectedEdition === ed.edition_number
              return (
                <button
                  key={ed.edition_number}
                  onClick={() => setSelectedEdition(ed.edition_number)}
                  className={`w-full text-left px-3 py-2.5 rounded border transition-all ${
                    isActive
                      ? 'border-gold bg-gold/5 text-gold'
                      : 'border-transparent text-text-secondary hover:border-border-dark hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Edition {ed.edition_number}</span>
                    {ed.item_count > 0 && (
                      <span className="text-[10px] font-mono text-text-muted border border-border-dark px-1.5 py-0.5 rounded">
                        {ed.item_count}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Week of {formatWeek(ed.week_start)}
                  </p>
                </button>
              )
            })
          )}
        </div>

        {/* Main panel */}
        <div className="flex-1 md:pl-6 min-w-0">
          {/* Search bar */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search content across all editions..."
                className="w-full bg-bg-elevated border border-border-dark rounded px-4 py-2.5 text-text-secondary text-sm focus:outline-none focus:border-gold-muted placeholder-text-muted transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Search results */}
          {searchQuery.trim() && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-serif text-text-warm text-sm">Search Results</h3>
                {searching ? (
                  <span className="text-[10px] text-text-muted">Searching...</span>
                ) : (
                  <span className="text-[10px] text-text-muted font-mono">{searchResults.length} results</span>
                )}
              </div>
              {searchResults.length === 0 && !searching ? (
                <p className="text-text-muted text-xs">No results found.</p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map(result => (
                    <div
                      key={result.id}
                      className="border border-border-dark bg-bg-elevated rounded p-3 cursor-pointer hover:border-gold-muted transition-all"
                      onClick={() => {
                        setSearchQuery('')
                        setSelectedEdition(result.edition_number)
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] tracking-widest uppercase text-gold border border-gold-muted px-1.5 py-0.5 rounded">
                          Edition {result.edition_number}
                        </span>
                        <span className="text-[10px] text-text-muted uppercase tracking-wider">
                          {result.content_type}
                        </span>
                      </div>
                      <p className="text-text-secondary text-xs">{result.body.slice(0, 120)}{result.body.length > 120 ? '…' : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EditionTracker */}
          {!searchQuery.trim() && (
            <>
              {selectedEdition === null ? (
                <div className="card p-12 text-center text-text-muted">
                  <p>Select an edition above.</p>
                </div>
              ) : (
                <div>
                  <h2 className="font-serif text-xl text-gold mb-4">
                    {selectedEditionData
                      ? `Edition ${selectedEdition} — ${formatEditionRange(selectedEditionData.week_start, selectedEditionData.week_end)}`
                      : `Edition ${selectedEdition}`}
                  </h2>
                  <EditionTracker issueId={selectedIssueId} editionNumber={selectedEdition} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
