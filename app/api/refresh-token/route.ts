import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// S1c: keep both cookie lifetimes in one place, matching context/actions.ts.
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7d — outlives the ~1h token inside it.
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30d.

// S3: only same-site absolute paths may be a post-refresh destination
// (mirrors safeRedirectPath in middleware.ts). Blocks off-site / //host / /api.
function safeRedirectPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/api"))
    return null;
  return raw;
}

// S1a loop-termination: clear BOTH session cookies on a redirect *response*
// object (not the ambient store), so the Set-Cookie reliably attaches to the
// 307. A refresh failure must leave no stale access cookie behind, or the next
// protected hit would bounce back here forever instead of landing on /login.
function clearedRedirect(url: URL): NextResponse {
  const res = NextResponse.redirect(url);
  res.cookies.delete("firebaseAuthToken");
  res.cookies.delete("firebaseAuthRefreshToken");
  return res;
}

export const GET = async (request: NextRequest) => {
  const safePath = safeRedirectPath(
    request.nextUrl.searchParams.get("redirect")
  );

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("firebaseAuthRefreshToken")?.value;

  // No refresh token → the session is unrecoverable. Clear any stale access
  // cookie and go to /login, preserving the destination when it's safe.
  if (!refreshToken) {
    const loginUrl = new URL(
      `/login${safePath ? `?redirect=${encodeURIComponent(safePath)}` : ""}`,
      request.url
    );
    return clearedRedirect(loginUrl);
  }

  try {
    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=AIzaSyCmjn2Enchkf-BH3-dBuBfCJPKPDnqfeT8`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      }
    );
    if (!response.ok) {
      // H2: log the status only — never the body, which can echo credentials.
      console.error("❌ Firebase refresh failed:", response.status);
      throw new Error("Failed to refresh token");
    }

    const json = await response.json();

    if (!json.id_token || !json.refresh_token) {
      // H2: log the shape, not the payload — it can contain a live token.
      console.error("❌ Invalid response from Firebase:", Object.keys(json));
      throw new Error("Invalid token response");
    }

    const destination = new URL(safePath ?? "/", request.url);
    const res = NextResponse.redirect(destination);
    res.cookies.set("firebaseAuthToken", json.id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TOKEN_MAX_AGE,
      path: "/",
    });
    res.cookies.set("firebaseAuthRefreshToken", json.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (error) {
    console.log("Failed to refresh token", error);
    // Refresh failed → clear both cookies and land on /login (NOT "/"), so the
    // next protected hit has no refresh cookie and terminates at login instead
    // of looping back into this route.
    const loginUrl = new URL(
      `/login${safePath ? `?redirect=${encodeURIComponent(safePath)}` : ""}`,
      request.url
    );
    return clearedRedirect(loginUrl);
  }
};
