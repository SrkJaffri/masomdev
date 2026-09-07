import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnv } from "@/config/env";

const ADMIN_PREFIX = "/admin";
const LOGIN_PATH = "/admin/login";

/**
 * Gates the admin area. Role-based authorization is NOT done here (that lives
 * in RLS + requireAdmin); the middleware only ensures a request to /admin is
 * authenticated at all. Public pages skip session work entirely (their data is
 * anon/RLS-gated).
 *
 * Fast path: `getClaims()` cryptographically verifies the access-token JWT
 * signature against the project's JWKS (ES256 asymmetric keys, cached) using
 * WebCrypto — no Supabase Auth round-trip for healthy sessions, and never a
 * raw cookie decode. If the token is expired (or about to expire) the session
 * is refreshed first, exactly like getUser().
 *
 * Slow path: any failure (missing, expired, forged, or revoked session) falls
 * back to getUser(), which validates the token with the Auth server and
 * refreshes the session cookies. The real authorization gate stays with RLS on
 * every data query and with `requireAdmin()` (getUser) on full page loads.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { pathname } = request.nextUrl;
  const isAdminRoute =
    pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  const isLoginRoute = pathname === LOGIN_PATH;

  if (isAdminRoute && !isLoginRoute) {
    // Fast path: signature-verified JWT claims via the cached JWKS. Public
    // pages never need session validation here (data is anon/RLS-gated), so
    // they skip it entirely.
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (!claimsError && claims?.claims) {
      return response;
    }

    // Slow path: getUser() revalidates the token with the Auth server (not
    // just cookies) and refreshes the session when expired. This is also the
    // path that catches forged or revoked sessions.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = LOGIN_PATH;
      redirectUrl.search = "";
      redirectUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
