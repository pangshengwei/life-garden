import { NextResponse, type NextRequest } from 'next/server';
import { accessError, isHosted } from './lib/access';

export function proxy(request: NextRequest) {
  // The health endpoint returns no user data and checks storage separately.
  const response =
    request.nextUrl.pathname === '/api/health'
      ? NextResponse.next()
      : accessError(request) || NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isHosted()) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|icon.svg).*)'] };
