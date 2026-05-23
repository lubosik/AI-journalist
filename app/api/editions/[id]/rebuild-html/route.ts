import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

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
    process.env.SUPABASE_SERVICE_KEY!
  )

  // Verify edition exists
  const { data, error } = await supabase
    .from('newsletter_issues')
    .select('id, status')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return Response.json({ error: 'Edition not found' }, { status: 404 })
  }

  // Queue rebuild via pipeline_state — Python scheduler picks this up within 30s
  const { error: upsertError } = await supabase
    .from('pipeline_state')
    .upsert({ key: 'rebuild_html_request', value: JSON.stringify({ edition_id: params.id }) }, { onConflict: 'key' })

  if (upsertError) {
    return Response.json({ error: 'Failed to queue rebuild' }, { status: 500 })
  }

  return Response.json({ queued: true })
}
