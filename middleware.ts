import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;

  // If on /login and has token → go to home
  if (pathname.startsWith("/login") && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If on protected route and NO token → go to sign-in
  if (!pathname.startsWith("/login") && !token) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Otherwise, let them through
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin-dashboard/:path*", "/login", "/course-upload/:path*"],
};