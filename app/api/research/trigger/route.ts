import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const cookie = cookies().get('herald_auth')
  if (!cookie || cookie.value !== 'authenticated') {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { topic, deep } = await req.json()
  if (!topic?.trim()) {
    return Response.json({ error: 'Topic required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  await supabase.from('pipeline_state').upsert(
    {
      key: 'pending_research',
      value: JSON.stringify({ topic: topic.trim(), deep: deep || false, timestamp: new Date().toISOString() }),
    },
    { onConflict: 'key' }
  )

  await supabase.from('conversation_memory').insert({
    role: 'user',
    content: `Research this topic${deep ? ' in depth' : ''}: ${topic.trim()}`,
    metadata: { source: 'dashboard', type: 'research_request' },
  }).then(() => {})

  return Response.json({ status: 'queued', topic: topic.trim() })
}
