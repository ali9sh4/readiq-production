import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login")) {
    const cookie = await cookies();
    const token = cookie.get("firebaseAuthToken")?.value;

    if (token) {
      try {
        await jwtVerify(token, JWKS, {
          issuer: `https://securetoken.google.com/readiq-1f109`,
          audience: "readiq-1f109",
        });
        return NextResponse.redirect(new URL("/", request.url));
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
      return NextResponse.redirect(new URL("/", request.url));
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
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: ["/admin-dashboard/:path*"],
};