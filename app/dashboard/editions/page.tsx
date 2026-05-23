'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { NewsletterIssue } from '@/types/herald'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'

const toRoman = (n: number) => {
  const vals = [10, 9, 5, 4, 1]
  const syms = ['X', 'IX', 'V', 'IV', 'I']
  let r = ''
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { r += syms[i]; n -= vals[i] }
  }
  return r
}

export default function EditionsPage() {
  const [issues, setIssues] = useState<NewsletterIssue[]>([])
  const [loading, setLoading] = useState(true)

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
          {issues.map(issue => (
            <Link key={issue.id} href={`/dashboard/editions/${issue.id}`}>
              <div className="card p-6 cursor-pointer hover:shadow-gold transition-all duration-300 group border border-transparent hover:border-gold-muted">
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
          ))}
        </div>
      )}
    </div>
  )
}
