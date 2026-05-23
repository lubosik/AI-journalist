import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

function authCheck() {
  const cookie = cookies().get('herald_auth')
  return cookie?.value === process.env.DASHBOARD_PASSWORD
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!authCheck()) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = serviceClient()
  const { data: issue } = await supabase
    .from('newsletter_issues')
    .select('issue_number')
    .eq('id', params.id)
    .single()

  if (!issue) return Response.json({ error: 'Edition not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const includeRemoved = searchParams.get('include_removed') === 'true'

  let query = supabase
    .from('edition_content')
    .select('*')
    .eq('edition_number', issue.issue_number)
    .order('created_at', { ascending: true })

  if (!includeRemoved) {
    query = query.eq('removed', false)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const items = data || []
  const grouped = items.reduce((acc: Record<string, unknown[]>, item) => {
    const key = item.content_type
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return Response.json({
    edition_number: issue.issue_number,
    total: items.length,
    active: items.filter((i) => !i.removed).length,
    grouped,
    all: items,
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!authCheck()) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  const { content_id, reason } = await req.json()
  const supabase = serviceClient()
  await supabase.from('edition_content').update({
    removed: true,
    removed_at: new Date().toISOString(),
    removed_reason: reason || 'Removed from dashboard',
  }).eq('id', content_id)
  return Response.json({ success: true })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!authCheck()) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  const { topic, topic_type, priority } = await req.json()
  if (!topic?.trim()) return Response.json({ error: 'Topic required' }, { status: 400 })

  const supabase = serviceClient()
  const { data: issue } = await supabase
    .from('newsletter_issues')
    .select('issue_number')
    .eq('id', params.id)
    .single()

  if (!issue) return Response.json({ error: 'Edition not found' }, { status: 404 })

  const { data: week } = await supabase
    .from('edition_weeks')
    .select('*')
    .eq('edition_number', issue.issue_number)
    .single()

  await supabase.from('edition_content').insert({
    edition_number: issue.issue_number,
    week_start: week?.week_start || new Date().toISOString().split('T')[0],
    week_end: week?.week_end || new Date().toISOString().split('T')[0],
    content_type: topic_type || 'topic',
    title: topic.substring(0, 100),
    body: topic,
    priority: priority || 5,
    added_by: 'dashboard',
  })

  // Also write to conversation_memory so Telegram agent is aware
  await supabase.from('conversation_memory').insert({
    role: 'user',
    content: `Include this in Edition ${issue.issue_number}: ${topic}`,
    metadata: { source: 'dashboard', edition: issue.issue_number },
  })

  return Response.json({ success: true })
}
