import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const cookie = cookies().get('herald_auth')
  if (!cookie || cookie.value !== 'authenticated') {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { topic, deep } = await req.json()
  if (!topic?.trim()) {
    return Response.json({ error: 'Topic required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pipeline_triggers')
    .insert({
      trigger_type: 'research_topic',
      payload: { topic: topic.trim(), deep: Boolean(deep) },
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ status: 'queued', topic: topic.trim(), trigger_id: data.id })
}
