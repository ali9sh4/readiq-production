import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet, decodeJwt } from "jose";
import path from "path";

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

// Only same-site absolute paths may be used as post-login destinations
// (mirrors sanitizeRedirectPath in context/authContext.tsx).
function safeRedirectPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/api"))
    return null;
  return raw;
}

// OWNER-ONLY (S1a): repair a stale session via the refresh cookie, else fall
// back to /login. Redirecting to /api/refresh-token when a refresh cookie is
// present lets a slept-tab session self-heal; that route clears BOTH cookies
// and lands on /login on failure, so this can never loop.
function repairOrLogin(
  request: NextRequest,
  pathname: string,
  refreshToken: string | undefined
) {
  const target = refreshToken
    ? `/api/refresh-token?redirect=${encodeURIComponent(pathname)}`
    : `/login?redirect=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(new URL(target, request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forget-password")
  ) {
    const cookie = await cookies();
    const token = cookie.get("firebaseAuthToken")?.value;

    if (token) {
      try {
        await jwtVerify(token, JWKS, {
          issuer: `https://securetoken.google.com/readiq-1f109`,
          audience: "readiq-1f109",
        });
        // Already signed in — honor the intended destination instead of
        // dumping the user on the homepage.
        const destination =
          safeRedirectPath(request.nextUrl.searchParams.get("redirect")) ??
          "/";
        return NextResponse.redirect(new URL(destination, request.url));
      } catch (error) {
        console.log(error);
        return NextResponse.next();
      }
    }
    return NextResponse.next();
  }

  try {
    const cookie = await cookies();
    const token = cookie.get("firebaseAuthToken")?.value;
    // OWNER-ONLY (S1a): middleware now also reads the refresh cookie so a
    // stale/absent access token can be repaired via /api/refresh-token instead
    // of bouncing straight to /login.
    const refreshToken = cookie.get("firebaseAuthRefreshToken")?.value;

    if (!token) {
      // Repair via the refresh cookie when present; else /login, destination
      // preserved so completing sign-in returns the user to their page.
      return repairOrLogin(request, pathname, refreshToken);
    }
    const decodedToken = decodeJwt(token);

    // Proactively refresh only when we actually can (refresh cookie present).
    // Without one, fall through: a still-valid token renders its remaining
    // life; a truly-expired token fails jwtVerify below and hits the catch.
    if (
      refreshToken &&
      decodedToken.exp &&
      (decodedToken.exp - 300) * 1000 < Date.now()
    ) {
      console.log("⏰ Token expiring, redirecting to refresh");
      return NextResponse.redirect(
        new URL(
          `/api/refresh-token?redirect=${encodeURIComponent(pathname)}`,
          request.url
        )
      );
    }

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/readiq-1f109`,
      audience: "readiq-1f109",
    });

    if (pathname.startsWith("/admin-dashboard")) {
      if (!payload.admin) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    const response = NextResponse.next();
    response.headers.set("x-user-id", payload.sub || "");
    response.headers.set("x-user-email", String(payload.email || ""));
    response.headers.set("x-user-admin", String(payload.admin === true));

    return response;
  } catch (error) {
    console.log(error);
    // OWNER-ONLY (S1a): a corrupt/invalid access token is still recoverable if
    // a refresh cookie exists — repair via /api/refresh-token; else /login.
    const refreshToken = (await cookies()).get(
      "firebaseAuthRefreshToken"
    )?.value;
    return repairOrLogin(request, pathname, refreshToken);
  }
}

// IMPORTANT: /api/* is intentionally NOT in this matcher.
//
// Mobile API routes use bearer-token auth via `Authorization: Bearer <id token>`,
// verified in each handler with `lib/auth/verifyBearerToken.ts`. They must NOT
// hit the cookie-based redirect logic above — mobile clients don't send cookies.
//
// Existing API routes (`/api/refresh-token`, `/api/payments/zaincash/*`) also
// rely on bypassing middleware. Adding `/api/:path*` here will break both the
// future mobile app and the existing payment flow. Don't do it.
export const config = {
  matcher: [
    "/admin-dashboard/:path*",
    "/login",
    "/register",
    "/forget-password",
    "/course-upload/:path*",
    "/user_dashboard/:path*",
    "/delete-account",
  ],
};
