import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-server'

function authCheck() {
  const cookie = cookies().get('herald_auth')
  return cookie?.value === 'authenticated'
}

async function getCurrentEditionNumber(supabase: ReturnType<typeof createServiceClient>): Promise<number> {
  try {
    const { data } = await supabase
      .from('pipeline_state')
      .select('value')
      .eq('key', 'current_edition_number')
      .single()
    return parseInt(data?.value || '1')
  } catch {
    return 1
  }
}

export async function GET() {
  if (!authCheck()) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  try {
    const supabase = createServiceClient()
    const editionNumber = await getCurrentEditionNumber(supabase)

    const { data: topics, error } = await supabase
      .from('edition_topics')
      .select('*')
      .eq('edition_number', editionNumber)
      .eq('used', false)
      .order('priority', { ascending: false })

    if (error) {
      console.error('[topics GET]', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ edition_number: editionNumber, topics: topics || [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[topics GET] unexpected error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!authCheck()) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  try {
    const supabase = createServiceClient()
    const editionNumber = await getCurrentEditionNumber(supabase)
    const body = await req.json()
    const { topic, topic_type = 'topic', priority = 5 } = body

    if (!topic?.trim()) {
      return Response.json({ error: 'topic is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('edition_topics')
      .insert({
        edition_number: editionNumber,
        topic: topic.trim(),
        topic_type,
        priority,
        source: 'dashboard',
        added_by: 'dom',
        used: false,
      })
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ topic: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!authCheck()) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('edition_topics')
      .delete()
      .eq('id', parseInt(id) || id)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ deleted: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
