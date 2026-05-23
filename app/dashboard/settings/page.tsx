'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'

export default function SettingsPage() {
  const [ps, setPs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    supabase.from('pipeline_state').select('key, value').then(({ data }) => {
      if (data) {
        const s: Record<string, string> = {}
        data.forEach((r: { key: string; value: string }) => { s[r.key] = r.value })
        setPs(s)
      }
      setLoading(false)
    })
  }, [])

  const toggle = async (key: string) => {
    const newVal = ps[key] === 'true' ? 'false' : 'true'
    await supabase.from('pipeline_state').upsert({ key, value: newVal }, { onConflict: 'key' })
    setPs(prev => ({ ...prev, [key]: newVal }))
    toast.success(`${key} set to ${newVal}`)
  }

  const save = async (key: string) => {
    setSaving(true)
    const { error } = await supabase.from('pipeline_state').upsert({ key, value: ps[key] || '' }, { onConflict: 'key' })
    setSaving(false)
    if (error) { toast.error('Save failed'); return }
    toast.success('Saved')
  }

  const triggerPipeline = async (key: string) => {
    await supabase.from('pipeline_state').upsert({ key, value: 'true' }, { onConflict: 'key' })
    toast.success(`${key} triggered — check Telegram for results`)
  }

  if (loading) {
    return <div className="animate-pulse"><div className="h-8 bg-bg-elevated rounded w-48 mb-8" /></div>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-xl md:text-3xl text-text-warm">Settings</h1>
        <div className="gold-divider mt-3" />
      </div>
      <div className="max-w-2xl w-full space-y-6">
        {/* Pipeline Controls */}
        <div className="card p-6">
          <h2 className="font-serif text-xl text-text-warm mb-6">Pipeline Controls</h2>
          <div className="space-y-4">
            {[
              { key: 'paused', label: 'Pause Pipeline' },
              { key: 'newsletter_paused', label: 'Pause Newsletter' },
            ].map(({ key, label }) => {
              const isOn = ps[key] === 'true'
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-text-secondary text-sm">{label}</span>
                  <button
                    onClick={() => toggle(key)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      isOn ? 'bg-gold' : 'bg-bg-elevated border border-border-dark'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        isOn ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Manual Triggers */}
        <div className="card p-6">
          <h2 className="font-serif text-xl text-text-warm mb-6">Manual Triggers</h2>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-text-secondary text-sm">Trigger Daily Ingestion</p>
                <p className="text-text-muted text-xs">Scrapes all sources immediately</p>
              </div>
              <button
                onClick={() => triggerPipeline('trigger_ingestion')}
                className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all min-h-[44px] sm:shrink-0"
              >
                Run Now
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-text-secondary text-sm">Trigger Newsletter Draft</p>
                <p className="text-text-muted text-xs">Starts draft generation pipeline</p>
              </div>
              <button
                onClick={() => triggerPipeline('trigger_draft')}
                className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all min-h-[44px] sm:shrink-0"
              >
                Draft Now
              </button>
            </div>
          </div>
        </div>

        {/* Edition Management */}
        <div className="card p-6">
          <h2 className="font-serif text-xl text-text-warm mb-6">Edition Management</h2>
          <div className="space-y-4">
            {[
              { key: 'current_edition_number', label: 'Current Edition Number', type: 'number' },
              { key: 'next_publish_date', label: 'Next Deadline (Sunday)', type: 'date' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-text-muted text-xs tracking-widest uppercase mb-2">{label}</label>
                <div className="flex gap-3">
                  <input
                    type={type}
                    value={ps[key] || ''}
                    onChange={e => setPs(prev => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 min-w-0 bg-bg-elevated border border-border-dark rounded px-3 py-2 text-text-warm text-sm font-mono focus:outline-none focus:border-gold-muted"
                  />
                  <button
                    onClick={() => save(key)}
                    disabled={saving}
                    className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all disabled:opacity-40 min-h-[44px] shrink-0"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
            {/* Edition Lock Time */}
            <div>
              <label className="block text-text-muted text-xs tracking-widest uppercase mb-2">
                Edition Lock Time (ISO datetime)
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={ps['edition_locked_after'] || ''}
                  onChange={e => setPs(prev => ({ ...prev, edition_locked_after: e.target.value }))}
                  placeholder="e.g. 2026-05-25T18:00:00"
                  className="flex-1 min-w-0 bg-bg-elevated border border-border-dark rounded px-3 py-2 text-text-warm text-sm font-mono focus:outline-none focus:border-gold-muted placeholder-text-muted"
                />
                <button
                  onClick={() => save('edition_locked_after')}
                  disabled={saving}
                  className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all disabled:opacity-40 min-h-[44px] shrink-0"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Beehiiv API */}
        <div className="card p-6">
          <h2 className="font-serif text-xl text-text-warm mb-6">Beehiiv API</h2>
          <div className="space-y-4">
            {/* API Key */}
            <div>
              <label className="block text-text-muted text-xs tracking-widest uppercase mb-2">
                Beehiiv API Key
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1 min-w-0">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={ps['beehiiv_api_key'] || ''}
                    onChange={e => setPs(prev => ({ ...prev, beehiiv_api_key: e.target.value }))}
                    placeholder="••••••••••••••••"
                    className="w-full bg-bg-elevated border border-border-dark rounded px-3 py-2 pr-10 text-text-warm text-sm font-mono focus:outline-none focus:border-gold-muted placeholder-text-muted"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1"
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={() => save('beehiiv_api_key')}
                  disabled={saving}
                  className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all disabled:opacity-40 min-h-[44px] shrink-0"
                >
                  Save
                </button>
              </div>
            </div>
            {/* Publication ID */}
            <div>
              <label className="block text-text-muted text-xs tracking-widest uppercase mb-2">
                Publication ID
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={ps['beehiiv_publication_id'] || ''}
                  onChange={e => setPs(prev => ({ ...prev, beehiiv_publication_id: e.target.value }))}
                  placeholder="pub_xxxxxxxx"
                  className="flex-1 min-w-0 bg-bg-elevated border border-border-dark rounded px-3 py-2 text-text-warm text-sm font-mono focus:outline-none focus:border-gold-muted placeholder-text-muted"
                />
                <button
                  onClick={() => save('beehiiv_publication_id')}
                  disabled={saving}
                  className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all disabled:opacity-40 min-h-[44px] shrink-0"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
