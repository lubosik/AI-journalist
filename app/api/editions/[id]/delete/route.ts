import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(
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

  const { error } = await supabase
    .from('newsletter_issues')
    .delete()
    .eq('id', params.id)
    .in('status', ['draft', 'generating', 'paused', 'declined'])

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await supabase
    .from('edition_calendar')
    .update({ status: 'future', newsletter_issue_id: null })
    .eq('newsletter_issue_id', params.id)

  return Response.json({ success: true })
}
