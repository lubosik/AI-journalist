import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const protectedApi = pathname.startsWith('/api/')
    && !pathname.startsWith('/api/auth')
    && pathname !== '/api/health'
  if (pathname.startsWith('/dashboard') || protectedApi) {
    const authCookie = request.cookies.get('herald_auth')
    if (!authCookie || authCookie.value !== 'authenticated') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
      }
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
