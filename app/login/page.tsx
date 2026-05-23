'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) { router.push('/dashboard') }
      else { toast.error('Incorrect password') }
    } catch { toast.error('Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl text-gold tracking-widest mb-2">The AI Journalist</h1>
          <p className="text-text-muted text-xs tracking-[0.2em] uppercase">Intelligence Dashboard</p>
        </div>
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-text-secondary text-xs tracking-widest uppercase mb-3">Access Code</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-elevated border border-border-dark rounded px-4 py-3 text-text-warm font-mono text-sm focus:outline-none focus:border-gold transition-colors"
                placeholder="Enter access code"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-transparent border border-gold text-gold py-3 rounded text-sm tracking-widest uppercase hover:bg-gold hover:text-bg-primary transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Enter'}
            </button>
          </form>
        </div>
        <div className="gold-divider mt-12" />
      </div>
    </div>
  )
}
