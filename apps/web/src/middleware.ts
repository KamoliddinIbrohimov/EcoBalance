import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Lightweight edge middleware: only guards route access based on the
 * presence of the refresh_token cookie. Real authorization happens client-side
 * in AuthBoot (which calls /auth/refresh + /auth/me).
 *
 * If someone visits a protected route without a refresh cookie → send to /login.
 * If someone visits /login while already authenticated → send to /.
 */
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

// 3-rol LMS: eski ekologik monitoring modullari olib tashlangan. Agar
// kimdir to'g'ridan to'g'ri URL bilan kirsa, bosh sahifaga qaytariladi.
// Kelajakda qayta ishlatish uchun kod va DB saqlab qolingan.
/**
 * Eski ekologik monitoring modullari — hozircha hamma uchun bloklangan.
 * /monitoring/tests (ekologik testlar) ishlab turibdi — alohida tekshiramiz.
 */
const HIDDEN_LEGACY_PATHS = ['/mahalla', '/news', '/organizations', '/recommendations', '/reports', '/analytics', '/events'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasRefresh = req.cookies.has('refresh_token');
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isPublic && !hasRefresh) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Eski modullar — bosh sahifaga qaytar (/monitoring/tests saqlanadi)
  const isLegacyMonitoring = pathname === '/monitoring' || pathname.startsWith('/monitoring/') && !pathname.startsWith('/monitoring/tests');
  const isLegacy = HIDDEN_LEGACY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isLegacy || isLegacyMonitoring) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (isPublic && hasRefresh && pathname !== '/reset-password') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
