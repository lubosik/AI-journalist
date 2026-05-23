'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [ps, setPs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

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
        <h1 className="font-serif text-3xl text-text-warm">Settings</h1>
        <div className="gold-divider mt-3" />
      </div>
      <div className="max-w-2xl space-y-6">
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Trigger Daily Ingestion</p>
                <p className="text-text-muted text-xs">Scrapes all sources immediately</p>
              </div>
              <button
                onClick={() => triggerPipeline('trigger_ingestion')}
                className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all"
              >
                Run Now
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Trigger Newsletter Draft</p>
                <p className="text-text-muted text-xs">Starts draft generation pipeline</p>
              </div>
              <button
                onClick={() => triggerPipeline('trigger_draft')}
                className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all"
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
              { key: 'next_publish_date', label: 'Next Publish Date', type: 'date' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-text-muted text-xs tracking-widest uppercase mb-2">{label}</label>
                <div className="flex gap-3">
                  <input
                    type={type}
                    value={ps[key] || ''}
                    onChange={e => setPs(prev => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 bg-bg-elevated border border-border-dark rounded px-3 py-2 text-text-warm text-sm font-mono focus:outline-none focus:border-gold-muted"
                  />
                  <button
                    onClick={() => save(key)}
                    disabled={saving}
                    className="border border-gold-muted text-gold px-4 py-2 rounded text-xs tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Beehiiv Publishing */}
        <div className="card p-6">
          <h2 className="font-serif text-xl text-text-warm mb-4">Beehiiv Publishing</h2>
          <div className="p-4 bg-bg-elevated rounded border border-gold-muted">
            <p className="text-text-secondary text-sm">
              Publishing requires manual approval in the Beehiiv dashboard.
            </p>
            <p className="text-text-muted text-xs mt-2">
              When a draft is approved here, the HTML is saved. Copy it from the edition page
              and paste into Beehiiv to create or update your draft. Publishing is a manual
              step in Beehiiv for full control.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
