import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-server'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const cookie = cookies().get('herald_auth')
  if (!cookie || cookie.value !== 'authenticated') {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Clear foreign-key references first so the main delete doesn't hit a constraint
  await supabase
    .from('edition_calendar')
    .update({ status: 'future', newsletter_issue_id: null })
    .eq('newsletter_issue_id', params.id)

  const { error } = await supabase
    .from('newsletter_issues')
    .delete()
    .eq('id', params.id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
