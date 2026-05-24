'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { NewsletterIssue, Section, Visual } from '@/types/herald'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { toast } from 'sonner'

const EditionTracker = dynamic(() => import('@/components/editions/EditionTracker'), { ssr: false })

const toRoman = (n: number) => {
  const vals = [10, 9, 5, 4, 1]
  const syms = ['X', 'IX', 'V', 'IV', 'I']
  let r = ''
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { r += syms[i]; n -= vals[i] }
  }
  return r
}

const TABS = ['Preview', 'Edit Content', 'Edition Tracker', 'Raw HTML', 'Copy & Export'] as const
type Tab = typeof TABS[number]

function estimateReadTime(html: string): string {
  const words = html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
  const mins = Math.ceil(words / 200)
  return `~${mins} min read`
}

export default function EditionPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [issue, setIssue] = useState<NewsletterIssue | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('Preview')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const sectionRefs = useRef<Record<string, string>>({})
  const sectionDirtyRef = useRef<Record<string, string>>({})

  function parseIssue(data: Record<string, unknown>): NewsletterIssue {
    const sections = typeof data.sections === 'string'
      ? (() => { try { return JSON.parse(data.sections as string) } catch { return [] } })()
      : (data.sections || [])
    const visuals = typeof data.visuals === 'string'
      ? (() => { try { return JSON.parse(data.visuals as string) } catch { return [] } })()
      : (data.visuals || [])
    return { ...data, sections, visuals } as unknown as NewsletterIssue
  }

  useEffect(() => {
    supabase
      .from('newsletter_issues')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) toast.error(`Failed to load edition: ${error.message}`)
        if (data) setIssue(parseIssue(data as Record<string, unknown>))
        setLoading(false)
      })

    const channel = supabase
      .channel(`issue-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'newsletter_issues', filter: `id=eq.${id}` },
        (payload) => setIssue(parseIssue(payload.new as Record<string, unknown>)))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  const copyHTML = async () => {
    if (!issue?.html_content) { toast.error('No HTML available'); return }
    await navigator.clipboard.writeText(issue.html_content)
    toast.success('HTML copied to clipboard')
  }

  const handleApprove = async () => {
    if (!issue) return
    const { error } = await supabase.from('newsletter_issues').update({ status: 'approved' }).eq('id', issue.id)
    if (error) { toast.error('Failed to approve'); return }
    toast.success(`Edition ${issue.issue_number} approved`)
  }

  const handleDecline = async () => {
    if (!issue || !confirm('Decline this edition?')) return
    const { error } = await supabase.from('newsletter_issues').update({ status: 'declined' }).eq('id', issue.id)
    if (error) { toast.error('Failed to decline'); return }
    toast.success('Edition declined')
  }

  const handleDelete = async () => {
    if (!issue) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/editions/${issue.id}/delete`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Delete failed'); setDeleting(false); return }
      toast.success('Draft deleted successfully')
      router.push('/dashboard/editions')
    } catch {
      toast.error('Delete failed')
      setDeleting(false)
    }
  }

  const saveSection = async (sectionId: string, content: string): Promise<boolean> => {
    if (!issue) return false
    setSavingSection(sectionId)
    const updatedSections = (issue.sections || []).map(s =>
      s.id === sectionId ? { ...s, content } : s
    )
    const { error } = await supabase
      .from('newsletter_issues')
      .update({ sections: updatedSections })
      .eq('id', issue.id)
    setSavingSection(null)
    if (error) { toast.error('Save failed'); return false }
    setIssue(prev => prev ? { ...prev, sections: updatedSections } : null)
    delete sectionDirtyRef.current[sectionId]
    // Track the edit in edition_content (fire-and-forget)
    fetch(`/api/editions/${issue.id}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: `Section edit: ${sectionId} — ${content.slice(0, 80)}`,
        topic_type: 'draft_edit',
        priority: 6,
      }),
    }).catch(() => {})
    return true
  }

  const rebuildHTML = async () => {
    if (!issue) return
    // Merge ALL dirty edits into one DB write to avoid snapshot-overwrite races
    const dirtyEntries = Object.entries(sectionDirtyRef.current)
    if (dirtyEntries.length > 0) {
      const mergedSections = (issue.sections || []).map(s =>
        sectionDirtyRef.current[s.id] !== undefined
          ? { ...s, content: sectionDirtyRef.current[s.id] }
          : s
      )
      const { error } = await supabase
        .from('newsletter_issues')
        .update({ sections: mergedSections })
        .eq('id', issue.id)
      if (error) { toast.error('Could not save sections — rebuild aborted'); return }
      setIssue(prev => prev ? { ...prev, sections: mergedSections } : null)
      sectionDirtyRef.current = {}
    }
    setRebuilding(true)
    try {
      const res = await fetch(`/api/editions/${issue.id}/rebuild-html`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(`Rebuild failed: ${body.error ?? res.status}`)
        return
      }
      // Immediately apply the new HTML to state — no page refresh or realtime wait needed
      if (body.html) {
        setIssue(prev => prev ? { ...prev, html_content: body.html } : null)
      }
      toast.success('Rebuilt — preview updated')
    } catch {
      toast.error('Rebuild request failed')
    } finally {
      setRebuilding(false)
    }
  }

  const saveRawHTML = async (html: string) => {
    if (!issue) return
    const { error } = await supabase.from('newsletter_issues').update({ html_content: html }).eq('id', issue.id)
    if (error) { toast.error('Save failed'); return }
    toast.success('HTML saved')
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-bg-elevated rounded w-1/3" />
        <div className="card p-6 h-96" />
      </div>
    )
  }
  if (!issue) return <p className="text-text-muted">Edition not found</p>

  const canDelete = ['draft', 'generating', 'paused', 'declined'].includes(issue.status)

  // Dedup sections: if both 'deal' and 'deal_watch' exist, skip 'deal'.
  // Also exclude 'footer' from the general iterator — it has its own dedicated field.
  const hasDealWatch = (issue.sections || []).some(s => s.id === 'deal_watch')
  const displaySections = (issue.sections || []).filter(s => {
    if (s.id === 'deal' && hasDealWatch) return false
    if (s.id === 'footer') return false
    return true
  })

  // Resolve display title for deal-related sections
  function getSectionTitle(section: { id: string; title?: string }): string {
    if (section.id === 'deal' || section.id === 'deal_watch') return 'Deals'
    return section.title || section.id
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-xl md:text-3xl text-gold">EDITION {toRoman(issue.issue_number)}</h1>
          <p className="text-text-secondary text-sm mt-1 line-clamp-2">{issue.subject_line}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={issue.status} />
          {canDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs px-3 py-2 rounded border border-red-900 text-red-700 hover:bg-red-900 hover:text-red-300 tracking-widest uppercase transition-all min-h-[44px] flex items-center"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-bg-secondary border border-border-dark rounded-lg p-8 max-w-sm w-full mx-4">
            <h3 className="font-serif text-xl text-text-warm mb-3">Delete Edition {issue.issue_number}?</h3>
            <p className="text-text-muted text-sm mb-6">
              This removes the draft from the database entirely and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-900 text-red-200 px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-red-800 transition-all disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-border-dark text-text-muted px-4 py-2 rounded text-xs tracking-widest uppercase hover:border-gold-muted transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {issue.status === 'draft' && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={copyHTML} className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all min-h-[44px]">
            Copy HTML
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-6">
        <div className="flex gap-0 border-b border-border-dark min-w-max md:min-w-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 md:px-4 py-2.5 text-xs md:text-sm tracking-wide transition-colors border-b-2 -mb-px whitespace-nowrap min-h-[44px] ${
                activeTab === tab ? 'text-gold border-gold' : 'text-text-muted border-transparent hover:text-text-secondary'
              }`}
            >
              {tab === 'Edition Tracker' ? 'Tracker' : tab === 'Copy & Export' ? 'Export' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Preview */}
      {activeTab === 'Preview' && (
        <div className="card overflow-hidden">
          {issue.html_content ? (
            <iframe
              srcDoc={issue.html_content}
              className="w-full border-0"
              style={{ height: '80vh' }}
              title="Newsletter preview"
            />
          ) : (
            <div className="p-12 text-center text-text-muted">
              <p>No HTML preview available yet.</p>
              {issue.plain_text && (
                <pre className="mt-4 text-left text-sm text-text-secondary whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                  {issue.plain_text}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Edit Content */}
      {activeTab === 'Edit Content' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <p className="text-text-muted text-xs flex-1">Edit section content. Press Save &amp; Rebuild to update the preview.</p>
            <button
              onClick={rebuildHTML}
              disabled={rebuilding}
              className="bg-gold text-bg-primary px-5 py-2.5 rounded text-xs tracking-widest uppercase hover:bg-gold-light transition-all disabled:opacity-40 min-h-[44px] w-full sm:w-auto"
            >
              {rebuilding ? 'Building...' : 'Save & Rebuild'}
            </button>
          </div>

          {/* Subject Line field */}
          <SubjectLineField issue={issue} onSaved={(val) => setIssue(prev => prev ? { ...prev, subject_line: val } : null)} />

          {/* Note / Preview Text field */}
          <NoteField issue={issue} onSaved={(val) => setIssue(prev => prev ? { ...prev, preview_text: val } : null)} />

          {/* Section editors */}
          {displaySections.map((section, idx) => (
            <div key={section.id || idx} className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-serif text-text-warm">{getSectionTitle(section)}</h4>
                <div className="flex items-center gap-3">
                  {section.word_count && (
                    <span className="text-text-muted text-xs font-mono">{section.word_count} words</span>
                  )}
                  {section.locked && (
                    <span className="text-xs text-gold border border-gold-muted px-2 py-0.5 rounded">LOCKED</span>
                  )}
                  {savingSection === section.id && (
                    <span className="text-xs text-gold-muted">Saving...</span>
                  )}
                </div>
              </div>
              <textarea
                className="w-full bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary text-sm font-mono focus:outline-none focus:border-gold-muted resize-none transition-colors"
                rows={8}
                defaultValue={section.content || ''}
                onChange={(e) => { sectionDirtyRef.current[section.id] = e.target.value }}
                onBlur={(e) => {
                  const newVal = e.target.value
                  const orig = sectionRefs.current[section.id]
                  if (newVal !== orig) {
                    saveSection(section.id, newVal)
                  }
                }}
                onFocus={(e) => { sectionRefs.current[section.id] = e.target.value }}
              />
            </div>
          ))}
          {displaySections.length === 0 && (
            <p className="text-text-muted text-center py-12">No sections available.</p>
          )}

          {/* Footer sign-off */}
          <FooterField
            issue={issue}
            onSaved={(sections) => setIssue(prev => prev ? { ...prev, sections } : null)}
          />

          {/* Visuals manager */}
          <VisualsManager
            issue={issue}
            onVisualsUpdated={(visuals) => setIssue(prev => prev ? { ...prev, visuals } : null)}
            onRebuild={rebuildHTML}
          />
        </div>
      )}

      {/* TAB 3: Edition Tracker */}
      {activeTab === 'Edition Tracker' && issue && (
        <EditionTracker issueId={issue.id} editionNumber={issue.issue_number} />
      )}

      {/* TAB 4: Raw HTML */}
      {activeTab === 'Raw HTML' && (
        <RawHTMLTab issue={issue} onSave={saveRawHTML} />
      )}

      {/* TAB 5: Copy & Export */}
      {activeTab === 'Copy & Export' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <div>
                <h3 className="font-serif text-text-warm mb-1">Export HTML</h3>
                <p className="text-text-muted text-xs">
                  {issue.html_content
                    ? `${issue.html_content.length.toLocaleString()} characters · ${estimateReadTime(issue.html_content)}`
                    : 'No HTML available'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 sm:mt-0">
                <button
                  onClick={copyHTML}
                  disabled={!issue.html_content}
                  className="bg-gold text-bg-primary px-4 py-2.5 rounded text-xs tracking-widest uppercase hover:bg-gold-light transition-all disabled:opacity-40 min-h-[44px]"
                >
                  Copy HTML
                </button>
                <button
                  onClick={() => {
                    if (!issue.html_content) return
                    const blob = new Blob([issue.html_content], { type: 'text/html' })
                    const url = URL.createObjectURL(blob)
                    window.open(url, '_blank')
                  }}
                  disabled={!issue.html_content}
                  className="border border-gold-muted text-gold px-4 py-2.5 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all disabled:opacity-40 min-h-[44px]"
                >
                  Open in Tab
                </button>
              </div>
            </div>
            <p className="text-text-muted text-xs mt-4">
              Note: Publishing requires manual approval in Beehiiv dashboard. Copy HTML and paste into Beehiiv to create a draft.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-serif text-text-warm mb-3">Plain Text</h3>
            <pre className="text-text-secondary text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto bg-bg-elevated rounded p-4">
              {issue.plain_text || 'No plain text available'}
            </pre>
            {issue.plain_text && (
              <button
                onClick={() => { navigator.clipboard.writeText(issue.plain_text || ''); toast.success('Plain text copied') }}
                className="mt-3 border border-border-dark text-text-muted px-4 py-2 rounded text-xs tracking-widest uppercase hover:border-gold-muted transition-all"
              >
                Copy Plain Text
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SubjectLineField
// ---------------------------------------------------------------------------

function SubjectLineField({
  issue,
  onSaved,
}: {
  issue: NewsletterIssue
  onSaved: (val: string) => void
}) {
  const [value, setValue] = useState(issue.subject_line || '')
  const [saving, setSaving] = useState(false)
  const origRef = useRef(issue.subject_line || '')

  // Resync when realtime update changes the issue prop (but only if not actively editing)
  useEffect(() => {
    setValue(issue.subject_line || '')
    origRef.current = issue.subject_line || ''
  }, [issue.subject_line])

  const handleBlur = async () => {
    if (value === origRef.current) return
    setSaving(true)
    const { error } = await supabase
      .from('newsletter_issues')
      .update({ subject_line: value })
      .eq('id', issue.id)
    setSaving(false)
    if (error) { toast.error('Failed to save subject line'); return }
    origRef.current = value
    onSaved(value)
    toast.success('Subject line saved')
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif text-text-warm">Subject Line</h4>
        {saving && <span className="text-xs text-gold-muted">Saving...</span>}
      </div>
      <textarea
        className="w-full bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary text-sm font-mono focus:outline-none focus:border-gold-muted resize-none transition-colors"
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={() => { origRef.current = value }}
        placeholder="Newsletter subject line..."
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// NoteField (preview_text)
// ---------------------------------------------------------------------------

function NoteField({
  issue,
  onSaved,
}: {
  issue: NewsletterIssue
  onSaved: (val: string) => void
}) {
  const [value, setValue] = useState(issue.preview_text || '')
  const [saving, setSaving] = useState(false)
  const origRef = useRef(issue.preview_text || '')

  // Resync when realtime update changes the issue prop (but only if not actively editing)
  useEffect(() => {
    setValue(issue.preview_text || '')
    origRef.current = issue.preview_text || ''
  }, [issue.preview_text])

  const handleBlur = async () => {
    if (value === origRef.current) return
    setSaving(true)
    const { error } = await supabase
      .from('newsletter_issues')
      .update({ preview_text: value })
      .eq('id', issue.id)
    setSaving(false)
    if (error) { toast.error('Failed to save note'); return }
    origRef.current = value
    onSaved(value)
    toast.success('Note saved')
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif text-text-warm">Note</h4>
        {saving && <span className="text-xs text-gold-muted">Saving...</span>}
      </div>
      <textarea
        className="w-full bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary text-sm font-mono focus:outline-none focus:border-gold-muted resize-none transition-colors"
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={() => { origRef.current = value }}
        placeholder="Preview text / note..."
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// FooterField
// ---------------------------------------------------------------------------

const DEFAULT_FOOTER_NOTE = "You know a name I should? Hit reply.\n\n— D"

function FooterField({
  issue,
  onSaved,
}: {
  issue: NewsletterIssue
  onSaved: (sections: Section[]) => void
}) {
  const existingFooter = (issue.sections || []).find(s => s.id === 'footer')
  const [value, setValue] = useState(existingFooter?.content || DEFAULT_FOOTER_NOTE)
  const [saving, setSaving] = useState(false)
  const origRef = useRef(existingFooter?.content || DEFAULT_FOOTER_NOTE)

  useEffect(() => {
    const f = (issue.sections || []).find(s => s.id === 'footer')
    const v = f?.content || DEFAULT_FOOTER_NOTE
    setValue(v)
    origRef.current = v
  }, [issue.sections])

  const handleBlur = async () => {
    if (value === origRef.current) return
    setSaving(true)
    const currentSections = issue.sections || []
    const hasFooter = currentSections.some(s => s.id === 'footer')
    const updatedSections: Section[] = hasFooter
      ? currentSections.map(s => s.id === 'footer' ? { ...s, content: value } : s)
      : [...currentSections, { id: 'footer', title: 'Footer', content: value }]

    const { error } = await supabase
      .from('newsletter_issues')
      .update({ sections: updatedSections })
      .eq('id', issue.id)
    setSaving(false)
    if (error) { toast.error('Failed to save footer'); return }
    origRef.current = value
    onSaved(updatedSections)
    toast.success('Footer saved')
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif text-text-warm">Footer</h4>
        {saving && <span className="text-xs text-gold-muted">Saving...</span>}
      </div>
      <textarea
        className="w-full bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary text-sm font-mono focus:outline-none focus:border-gold-muted resize-none transition-colors"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={() => { origRef.current = value }}
        placeholder={DEFAULT_FOOTER_NOTE}
      />
      <p className="text-text-muted text-xs mt-2">Sign-off text shown at the bottom of the newsletter. Press Save &amp; Rebuild to see it in the preview.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VisualsManager
// ---------------------------------------------------------------------------

// Human-readable labels for placement keys
const SECTION_TITLE_MAP: Record<string, string> = {
  tldr: 'TL;DR',
  lead: 'The Lead',
  market_pulse: 'Market Pulse',
  angle: 'The Angle',
}

function buildPlacementOptions(sections: Section[]): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = [
    { value: 'top', label: 'Top — below headline' },
  ]
  // After each section that exists in the newsletter
  const orderedIds = ['tldr', 'lead', 'market_pulse', 'angle']
  const sectionIds = new Set(sections.map(s => s.id))
  for (const id of orderedIds) {
    if (sectionIds.has(id)) {
      const title = sections.find(s => s.id === id)?.title || SECTION_TITLE_MAP[id] || id
      opts.push({ value: `after_${id}`, label: `After ${title}` })
    }
  }
  opts.push({ value: 'before_deals', label: 'Before Deals' })
  opts.push({ value: 'bottom', label: 'Bottom — after Deals' })
  return opts
}

function VisualsManager({
  issue,
  onVisualsUpdated,
  onRebuild,
}: {
  issue: NewsletterIssue
  onVisualsUpdated: (visuals: Visual[]) => void
  onRebuild: () => void
}) {
  const placementOptions = buildPlacementOptions(issue.sections || [])
  const [addUrl, setAddUrl] = useState('')
  const [addPlacement, setAddPlacement] = useState(placementOptions[0]?.value || 'top')
  const [addAlt, setAddAlt] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null)

  // Only show visuals that have an actual URL — filter out failed generation placeholders
  const currentVisuals: Visual[] = (issue.visuals || []).filter(v => v.url?.trim())

  const saveVisuals = async (visuals: Visual[]): Promise<boolean> => {
    const { error } = await supabase
      .from('newsletter_issues')
      .update({ visuals })
      .eq('id', issue.id)
    if (error) { toast.error('Failed to save visuals'); return false }
    onVisualsUpdated(visuals)
    return true
  }

  const handleAdd = async () => {
    if (!addUrl.trim()) { toast.error('Image URL is required'); return }
    setAdding(true)
    const newVisual: Visual = {
      placement: addPlacement,
      url: addUrl.trim(),
      alt: addAlt.trim() || undefined,
    }
    const updated = [...currentVisuals, newVisual]
    const ok = await saveVisuals(updated)
    if (ok) {
      setAddUrl('')
      setAddAlt('')
      toast.success('Visual added — rebuilding…')
      onRebuild()
    }
    setAdding(false)
  }

  const handleDelete = async (idx: number) => {
    setDeletingIdx(idx)
    const updated = currentVisuals.filter((_, i) => i !== idx)
    const ok = await saveVisuals(updated)
    if (ok) {
      toast.success('Visual removed — rebuilding…')
      onRebuild()
    }
    setDeletingIdx(null)
  }

  // Human-friendly label for stored placement value
  const placementLabel = (val: string) =>
    placementOptions.find(o => o.value === val)?.label ?? val

  return (
    <div className="card p-6">
      <h4 className="font-serif text-text-warm mb-4">Visuals</h4>

      {/* Current visuals list */}
      {currentVisuals.length === 0 && (
        <p className="text-text-muted text-sm mb-4">No visuals attached.</p>
      )}
      {currentVisuals.length > 0 && (
        <div className="space-y-3 mb-6">
          {currentVisuals.map((v, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-bg-elevated rounded p-3 border border-border-dark">
              {/* Thumbnail */}
              <div className="shrink-0 w-14 h-10 rounded overflow-hidden bg-bg-primary border border-border-dark flex items-center justify-center">
                <img
                  src={v.url}
                  alt={v.alt || 'visual'}
                  className="object-cover w-full h-full"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-text-secondary text-xs font-mono truncate">{v.url}</p>
                <p className="text-text-muted text-xs mt-0.5">
                  <span className="text-gold-muted">{placementLabel(v.placement)}</span>
                  {v.alt && <span className="ml-2">· {v.alt}</span>}
                </p>
              </div>
              {/* Delete */}
              <button
                onClick={() => handleDelete(idx)}
                disabled={deletingIdx === idx}
                className="shrink-0 text-xs px-3 py-1.5 rounded border border-red-900 text-red-700 hover:bg-red-900 hover:text-red-300 tracking-widest uppercase transition-all disabled:opacity-40"
              >
                {deletingIdx === idx ? '...' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add visual form */}
      <div className="border-t border-border-dark pt-4">
        <p className="text-text-muted text-xs mb-3 tracking-wide uppercase font-sans">Add Image</p>
        <div className="space-y-3">
          <input
            type="url"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="Image URL (https://...)"
            className="w-full bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary text-sm font-mono focus:outline-none focus:border-gold-muted transition-colors"
          />
          <div className="flex gap-3">
            <select
              value={addPlacement}
              onChange={(e) => setAddPlacement(e.target.value)}
              className="flex-1 bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary text-sm focus:outline-none focus:border-gold-muted transition-colors"
            >
              {placementOptions.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={addAlt}
              onChange={(e) => setAddAlt(e.target.value)}
              placeholder="Alt text (optional)"
              className="flex-1 bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary text-sm font-mono focus:outline-none focus:border-gold-muted transition-colors"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !addUrl.trim()}
            className="bg-gold text-bg-primary px-5 py-2.5 rounded text-xs tracking-widest uppercase hover:bg-gold-light transition-all disabled:opacity-40 min-h-[44px]"
          >
            {adding ? 'Adding...' : 'Add Visual'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RawHTMLTab
// ---------------------------------------------------------------------------

function RawHTMLTab({ issue, onSave }: { issue: NewsletterIssue; onSave: (html: string) => void }) {
  const [value, setValue] = useState(issue.html_content || '')
  const [dirty, setDirty] = useState(false)

  // Resync when a rebuild updates html_content via realtime (but not if user is editing)
  useEffect(() => {
    if (!dirty) setValue(issue.html_content || '')
  }, [issue.html_content, dirty])

  return (
    <div className="card p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="font-serif text-text-warm">Raw HTML</h3>
        <div className="flex gap-2">
          {dirty && (
            <button
              onClick={() => { onSave(value); setDirty(false) }}
              className="bg-gold text-bg-primary px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold-light transition-all min-h-[44px]"
            >
              Save
            </button>
          )}
          <button
            onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied') }}
            className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all min-h-[44px]"
          >
            Copy
          </button>
        </div>
      </div>
      <textarea
        className="w-full bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary font-mono text-xs focus:outline-none focus:border-gold-muted resize-none"
        style={{ height: '55vh', maxHeight: '70vh' }}
        value={value}
        onChange={(e) => { setValue(e.target.value); setDirty(true) }}
      />
    </div>
  )
}
