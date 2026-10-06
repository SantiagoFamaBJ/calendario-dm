import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// /admin (minúscula) redirige a la ruta oficial /ADMIN
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin') {
    return NextResponse.redirect(new URL('/ADMIN', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin'],
};
