import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { buildNewsletterHTML, buildPlainText } from '@/lib/newsletterBuilder'
import type { Section, Visual } from '@/lib/newsletterBuilder'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const cookie = cookies().get('herald_auth')
  if (!cookie || cookie.value !== 'authenticated') {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Fetch full issue
  const { data: issue, error: fetchError } = await supabase
    .from('newsletter_issues')
    .select('id, status, sections, visuals, subject_line, issue_number, week_start')
    .eq('id', params.id)
    .single()

  if (fetchError || !issue) {
    return Response.json(
      { error: `Edition not found: ${fetchError?.message ?? 'no row'}` },
      { status: 404 }
    )
  }

  // Parse sections (may be stored as JSON string)
  let sections: Section[] = []
  if (typeof issue.sections === 'string') {
    try { sections = JSON.parse(issue.sections) } catch { sections = [] }
  } else if (Array.isArray(issue.sections)) {
    sections = issue.sections as Section[]
  }

  // Parse visuals (may be stored as JSON string)
  let visuals: Visual[] = []
  if (typeof issue.visuals === 'string') {
    try { visuals = JSON.parse(issue.visuals) } catch { visuals = [] }
  } else if (Array.isArray(issue.visuals)) {
    visuals = issue.visuals as Visual[]
  }

  // Fetch deals from pipeline_state
  let deals: { supply: string[]; demand: string[] } = { supply: [], demand: [] }
  const { data: dealsRow } = await supabase
    .from('pipeline_state')
    .select('value')
    .eq('key', 'newsletter_edition_deals')
    .single()

  if (dealsRow?.value) {
    try {
      const parsed =
        typeof dealsRow.value === 'string'
          ? JSON.parse(dealsRow.value)
          : dealsRow.value
      deals = {
        supply: Array.isArray(parsed.supply) ? parsed.supply : [],
        demand: Array.isArray(parsed.demand) ? parsed.demand : [],
      }
    } catch {
      // leave defaults
    }
  }

  // Build HTML
  let html: string
  try {
    html = await buildNewsletterHTML({
      sections,
      visuals,
      issueNumber: issue.issue_number,
      subjectLine: issue.subject_line,
      weekStart: issue.week_start ?? null,
      deals,
    })
  } catch (buildErr) {
    const msg = buildErr instanceof Error ? buildErr.message : String(buildErr)
    return Response.json({ error: `Build failed: ${msg}` }, { status: 500 })
  }

  // Build plain text
  const plain = buildPlainText(sections, deals)

  // Save HTML + plain text to newsletter_issues
  const { error: saveError } = await supabase
    .from('newsletter_issues')
    .update({
      html_content: html,
      plain_text: plain,
    })
    .eq('id', params.id)

  if (saveError) {
    return Response.json({ error: `Save failed: ${saveError.message}` }, { status: 500 })
  }

  // Still upsert pipeline_state so Python's Telegram notification fires
  await supabase
    .from('pipeline_state')
    .upsert(
      { key: 'rebuild_html_request', value: JSON.stringify({ edition_id: params.id }) },
      { onConflict: 'key' }
    )

  return Response.json({ success: true, html })
}
