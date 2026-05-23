'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { NewsletterIssue } from '@/types/herald'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { toast } from 'sonner'

const toRoman = (n: number) => {
  const vals = [10, 9, 5, 4, 1]
  const syms = ['X', 'IX', 'V', 'IV', 'I']
  let r = ''
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { r += syms[i]; n -= vals[i] }
  }
  return r
}

const TABS = ['Preview', 'Sections', 'Raw HTML'] as const
type Tab = typeof TABS[number]

export default function EditionPage() {
  const params = useParams()
  const id = params.id as string
  const [issue, setIssue] = useState<NewsletterIssue | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('Preview')
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    supabase
      .from('newsletter_issues')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setIssue(data as NewsletterIssue)
        setLoading(false)
      })

    const channel = supabase
      .channel(`issue-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'newsletter_issues', filter: `id=eq.${id}` },
        (payload) => setIssue(payload.new as NewsletterIssue)
      )
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
    if (!issue || !confirm('Decline this edition? This cannot be undone.')) return
    const { error } = await supabase.from('newsletter_issues').update({ status: 'declined' }).eq('id', issue.id)
    if (error) { toast.error('Failed to decline'); return }
    toast.success('Edition declined')
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

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-gold">EDITION {toRoman(issue.issue_number)}</h1>
          <p className="text-text-secondary text-sm mt-1">{issue.subject_line}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={issue.status} />
          {(issue.status === 'draft' || issue.status === 'approved') && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`text-xs px-3 py-1.5 rounded border tracking-widest uppercase transition-all ${
                editMode ? 'bg-gold text-bg-primary border-gold' : 'border-gold text-gold'
              }`}
            >
              {editMode ? 'Viewing' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {issue.status === 'draft' && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <button
            onClick={handleApprove}
            className="bg-gold text-bg-primary px-6 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold-light transition-all"
          >
            Approve and Publish
          </button>
          <button
            onClick={handleDecline}
            className="border border-border-dark text-text-muted px-4 py-2 rounded text-xs tracking-widest uppercase hover:border-red-900 hover:text-red-800 transition-all"
          >
            Decline
          </button>
          <button
            onClick={copyHTML}
            className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all"
          >
            Copy HTML
          </button>
        </div>
      )}

      <div className="flex gap-0 border-b border-border-dark mb-6">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm tracking-wide transition-colors border-b-2 -mb-px ${
              activeTab === tab ? 'text-gold border-gold' : 'text-text-muted border-transparent hover:text-text-secondary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Preview' && (
        <div className="card overflow-hidden">
          {issue.html_content ? (
            <iframe srcDoc={issue.html_content} className="w-full h-screen border-0" title="Newsletter preview" />
          ) : (
            <div className="p-12 text-center text-text-muted">
              <p>No HTML preview available</p>
              {issue.plain_text && (
                <pre className="mt-4 text-left text-sm text-text-secondary whitespace-pre-wrap font-mono">
                  {issue.plain_text}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Sections' && (
        <div className="space-y-4">
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
                </div>
              </div>
              <p className="text-text-secondary text-sm line-clamp-3 font-mono">
                {(section.content || '').slice(0, 300)}
              </p>
              {editMode && (
                <textarea
                  className="w-full mt-3 bg-bg-elevated border border-border-dark rounded p-3 text-text-secondary text-sm font-mono focus:outline-none focus:border-gold-muted resize-none"
                  rows={6}
                  defaultValue={section.content || ''}
                  onBlur={async (e) => {
                    if (!issue) return
                    const updatedSections = (issue.sections || []).map(s =>
                      s.id === section.id ? { ...s, content: e.target.value } : s
                    )
                    await supabase.from('newsletter_issues').update({ sections: updatedSections }).eq('id', issue.id)
                    toast.success('Saved')
                  }}
                />
              )}
            </div>
          ))}
          {(!issue.sections || issue.sections.length === 0) && (
            <p className="text-text-muted text-center py-12">No sections available</p>
          )}
        </div>
      )}

      {activeTab === 'Raw HTML' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-text-warm">Raw HTML</h3>
            <button
              onClick={copyHTML}
              className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all"
            >
              Copy HTML
            </button>
          </div>
          <textarea
            className="w-full h-96 bg-bg-elevated border border-border-dark rounded p-4 text-text-secondary font-mono text-xs focus:outline-none focus:border-gold-muted resize-none"
            value={issue.html_content || ''}
            readOnly={!editMode}
            onChange={(e) => {
              if (!editMode) return
              setIssue(prev => prev ? { ...prev, html_content: e.target.value } : null)
            }}
            onBlur={async () => {
              if (!editMode || !issue) return
              await supabase.from('newsletter_issues').update({ html_content: issue.html_content }).eq('id', issue.id)
              toast.success('Saved')
            }}
          />
        </div>
      )}
    </div>
  )
}
