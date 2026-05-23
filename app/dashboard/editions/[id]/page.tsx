'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { NewsletterIssue } from '@/types/herald'
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
    return { ...data, sections } as unknown as NewsletterIssue
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
      if (!res.ok) { toast.error('Rebuild failed'); return }
      toast.success('Rebuilding preview — updates in ~30 seconds')
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
          <button onClick={handleApprove} className="bg-gold text-bg-primary px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold-light transition-all min-h-[44px]">
            Approve
          </button>
          <button onClick={handleDecline} className="border border-border-dark text-text-muted px-4 py-2 rounded text-xs tracking-widest uppercase hover:border-red-900 hover:text-red-800 transition-all min-h-[44px]">
            Decline
          </button>
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
              {rebuilding ? 'Queuing...' : 'Save & Rebuild'}
            </button>
          </div>
          {(issue.sections || []).map((section, idx) => (
            <div key={section.id || idx} className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-serif text-text-warm">{section.title || section.id}</h4>
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
                    // sectionDirtyRef is cleared by saveSection only on success,
                    // so failed saves remain tracked for retry via Save & Rebuild
                  }
                }}
                onFocus={(e) => { sectionRefs.current[section.id] = e.target.value }}
              />
            </div>
          ))}
          {(!issue.sections || issue.sections.length === 0) && (
            <p className="text-text-muted text-center py-12">No sections available.</p>
          )}
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

function RawHTMLTab({ issue, onSave }: { issue: NewsletterIssue; onSave: (html: string) => void }) {
  const [value, setValue] = useState(issue.html_content || '')
  const [dirty, setDirty] = useState(false)

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
