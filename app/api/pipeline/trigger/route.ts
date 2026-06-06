import { cookies } from 'next/headers'

import { createServiceClient } from '@/lib/supabase-server'

const ALLOWED_TRIGGERS = new Set([
  'ingest_url',
  'research_topic',
  'approve_edition',
  'decline_edition',
  'trigger_ingestion',
  'trigger_draft',
])

export async function POST(req: Request) {
  const auth = cookies().get('herald_auth')
  if (auth?.value !== 'authenticated') {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: { trigger_type?: string; payload?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.trigger_type || !ALLOWED_TRIGGERS.has(body.trigger_type)) {
    return Response.json({ error: 'Unsupported trigger type' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pipeline_triggers')
    .insert({
      trigger_type: body.trigger_type,
      payload: body.payload || {},
      status: 'pending',
    })
    .select('id, status')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ status: 'queued', trigger_id: data.id })
}
