export interface ContentItem {
  id: string
  source_type: string
  source_name: string
  source_url?: string
  title?: string
  raw_text: string
  published_at?: string
  scraped_at: string
  is_voice_sample: boolean
  is_deal_signal: boolean
  topics: string[]
  metadata?: Record<string, unknown>
}

export interface Section {
  id: string
  title?: string
  content: string
  locked?: boolean
  word_count?: number
  voice_score?: number
}

export interface Visual {
  placement: string
  url: string
  alt?: string
  caption?: string
}

export interface NewsletterIssue {
  id: string
  issue_number: number
  subject_line: string
  preview_text?: string
  status: string
  html_content?: string
  plain_text?: string
  sections?: Section[]
  visuals?: Visual[]
  week_start?: string | null
  created_at: string
  updated_at?: string
}

export interface ActivityEvent {
  id: string
  type: 'INGESTION' | 'RESEARCH' | 'DRAFT_START' | 'DRAFT_READY' | 'PUBLISHED' | 'MORNING_BRIEF' | 'TELEGRAM_TIP'
  message: string
  source?: string
  timestamp: string
}
