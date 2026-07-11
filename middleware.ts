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

    if (!token) {
      // Send to login with the destination preserved, so completing sign-in
      // returns the user to the page they actually asked for.
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }
    const decodedToken = decodeJwt(token);

    if (decodedToken.exp && (decodedToken.exp - 300) * 1000 < Date.now()) {
      console.log("⏰ Token expiring, redirecting to refresh"); // ADD THIS
      return NextResponse.redirect(
        new URL(
          `/api/refresh-token?redirect=${encodeURIComponent(
            request.nextUrl.pathname
          )}`,
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
    // Invalid/expired token on a protected page — same as no token: go to
    // login and keep the destination.
    return NextResponse.redirect(
      new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
    );
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
