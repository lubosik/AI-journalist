'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { NewsletterIssue } from '@/types/herald'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'
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

const DELETABLE_STATUSES = ['draft', 'generating']

export default function EditionsPage() {
  const [issues, setIssues] = useState<NewsletterIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('newsletter_issues')
      .select('*')
      .order('issue_number', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setIssues(data as NewsletterIssue[])
        setLoading(false)
      })
  }, [])

  const handleDelete = async (e: React.MouseEvent, issue: NewsletterIssue) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete Edition ${issue.issue_number}? This cannot be undone.`)) return
    setDeletingId(issue.id)
    try {
      const res = await fetch(`/api/editions/${issue.id}/delete`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Delete failed')
        setDeletingId(null)
        return
      }
      setIssues(prev => prev.filter(i => i.id !== issue.id))
      toast.success(`Edition ${issue.issue_number} deleted`)
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-text-warm">Editions</h1>
        <div className="gold-divider mt-3" />
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-8 bg-bg-elevated rounded mb-4 w-1/2" />
              <div className="h-4 bg-bg-elevated rounded mb-2" />
              <div className="h-4 bg-bg-elevated rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {issues.map(issue => {
            const canDelete = DELETABLE_STATUSES.includes(issue.status)
            return (
              <div key={issue.id} className="relative group">
                {canDelete && (
                  <button
                    onClick={(e) => handleDelete(e, issue)}
                    disabled={deletingId === issue.id}
                    aria-label="Delete draft"
                    className="absolute top-3 right-3 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-red-900 text-red-700 hover:bg-red-900 hover:text-red-200 transition-all text-xs leading-none opacity-0 group-hover:opacity-100 disabled:opacity-40"
                  >
                    {deletingId === issue.id ? '…' : '×'}
                  </button>
                )}
                <Link href={`/dashboard/editions/${issue.id}`}>
                  <div className="card p-6 cursor-pointer hover:shadow-gold transition-all duration-300 border border-transparent hover:border-gold-muted">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-serif text-2xl text-gold group-hover:text-gold-light transition-colors">
                        EDITION {toRoman(issue.issue_number)}
                      </h3>
                      <StatusBadge status={issue.status} />
                    </div>
                    <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                      {issue.subject_line || 'No subject line'}
                    </p>
                    <p className="text-text-muted text-xs font-mono">
                      {new Date(issue.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
