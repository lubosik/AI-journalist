'use client'
import { useState } from 'react'
import { toast } from 'sonner'

export default function ResearchPanel() {
  const [topic, setTopic] = useState('')
  const [deep, setDeep] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<{ topic: string; status: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/research/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), deep }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Research failed'); return }
      setLastResult({ topic: topic.trim(), status: 'queued' })
      toast.success('Research queued. Telegram notification in ~30 seconds.')
      setTopic('')
    } catch {
      toast.error('Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-xl text-text-warm">Research</h3>
        <span className="text-text-muted text-xs">Results delivered to Telegram</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Research a topic..."
          className="w-full bg-bg-elevated border border-border-dark rounded px-4 py-3 text-text-warm text-sm focus:outline-none focus:border-gold-muted placeholder:text-text-muted"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-text-muted text-sm cursor-pointer">
            <div
              onClick={() => setDeep(!deep)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${deep ? 'bg-gold' : 'bg-bg-elevated border border-border-dark'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${deep ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            Deep research
          </label>
          <button
            type="submit"
            disabled={!topic.trim() || loading}
            className="bg-gold text-bg-primary px-6 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold-light transition-all disabled:opacity-40"
          >
            {loading ? 'Queuing...' : 'Research'}
          </button>
        </div>
      </form>
      {lastResult && (
        <div className="mt-4 p-3 bg-bg-elevated rounded border border-border-dark">
          <p className="text-text-muted text-xs">
            <span className="text-gold">Queued:</span> {lastResult.topic}
          </p>
          <p className="text-text-muted text-xs mt-1">Telegram notification in ~30 seconds.</p>
        </div>
      )}
    </div>
  )
}
