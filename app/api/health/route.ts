export async function GET() {
  return Response.json({ status: 'ok', service: 'herald-dashboard', timestamp: new Date().toISOString() })
}
