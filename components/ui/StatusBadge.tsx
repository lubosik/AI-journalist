const statusConfig: Record<string, { label: string; color: string }> = {
  future: { label: 'FUTURE', color: 'text-text-muted border-text-muted' },
  drafting: { label: 'DRAFTING', color: 'text-gold border-gold-muted' },
  draft_ready: { label: 'DRAFT READY', color: 'text-gold border-gold' },
  draft: { label: 'DRAFT', color: 'text-gold border-gold' },
  approved: { label: 'APPROVED', color: 'text-success-dark border-success-dark' },
  published: { label: 'PUBLISHED', color: 'text-success-dark border-success-dark' },
  skipped: { label: 'SKIPPED', color: 'text-text-muted border-text-muted' },
  generating: { label: 'GENERATING', color: 'text-gold border-gold animate-pulse' },
  discarded: { label: 'DISCARDED', color: 'text-text-muted border-text-muted' },
  declined: { label: 'DECLINED', color: 'text-red-800 border-red-900' },
  research: { label: 'RESEARCHING', color: 'text-text-secondary border-border-dark' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status.toUpperCase(), color: 'text-text-muted border-text-muted' }
  return (
    <span className={`text-xs tracking-widest border px-2 py-0.5 rounded ${config.color}`}>
      {config.label}
    </span>
  )
}
