'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface StatsState {
  totalItems: number
  weekItems: number
  voiceSamples: number
  dealSignals: number
  publishedEditions: number
  loading: boolean
}

export function DatabaseStats() {
  const [stats, setStats] = useState<StatsState>({
    totalItems: 0,
    weekItems: 0,
    voiceSamples: 0,
    dealSignals: 0,
    publishedEditions: 0,
    loading: true,
  })

  useEffect(() => {
    async function load() {
      try {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const [total, week, voice, deals, editions] = await Promise.all([
          supabase.from('content_items').select('id', { count: 'exact', head: true }),
          supabase.from('content_items').select('id', { count: 'exact', head: true }).gte('scraped_at', weekAgo.toISOString()),
          supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('is_voice_sample', true),
          supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('is_deal_signal', true),
          supabase.from('newsletter_issues').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        ])
        setStats({
          totalItems: total.count || 0,
          weekItems: week.count || 0,
          voiceSamples: voice.count || 0,
          dealSignals: deals.count || 0,
          publishedEditions: editions.count || 0,
          loading: false,
        })
      } catch (err) {
        console.error('[DatabaseStats] load error:', err)
        setStats(prev => ({ ...prev, loading: false }))
      }
    }
    load()
  }, [])

  const items = [
    { label: 'Total Items', value: stats.totalItems },
    { label: 'This Week', value: stats.weekItems },
    { label: 'Voice Samples', value: stats.voiceSamples },
    { label: 'Deal Signals', value: stats.dealSignals },
    { label: 'Published Editions', value: stats.publishedEditions },
  ]

  return (
    <div className="card p-6">
      <h3 className="font-serif text-lg text-text-warm mb-6">Database</h3>
      {stats.loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between animate-pulse">
              <div className="h-3 bg-bg-elevated rounded w-24" />
              <div className="h-3 bg-bg-elevated rounded w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.label} className="flex justify-between items-center">
              <span className="text-text-secondary text-sm">{item.label}</span>
              <span className="font-mono text-text-warm text-sm">{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
