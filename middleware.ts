export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  console.log("🔒 Middleware running on:", pathname);

  if (pathname.startsWith("/login")) {
    const cookie = await cookies();
    const token = cookie.get("firebaseAuthToken")?.value;
    console.log("📍 /login - Has token:", !!token);

    if (token) {
      try {
        await jwtVerify(token, JWKS, {
          issuer: `https://securetoken.google.com/readiq-1f109`,
          audience: "readiq-1f109",
        });
        console.log("✅ Token valid, redirecting to /");
        return NextResponse.redirect(new URL("/", request.url));
      } catch (error) {
        console.log("❌ Token verification failed:", error);
        return NextResponse.next();
      }
    }
    return NextResponse.next();
  }

  try {
    const cookie = await cookies();
    const token = cookie.get("firebaseAuthToken")?.value;

    console.log("📍 Protected route - Has token:", !!token);

    if (!token) {
      console.log("❌ No token found, redirecting to /");
      return NextResponse.redirect(new URL("/", request.url));
    }

    console.log("🔍 Verifying token...");
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/readiq-1f109`,
      audience: "readiq-1f109",
    });

    console.log("✅ Token verified:", { 
      sub: payload.sub, 
      email: payload.email,
      admin: payload.admin 
    });

    if (pathname.startsWith("/admin-dashboard")) {
      if (!payload.admin) {
        console.log("❌ Not admin, redirecting to /");
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    const response = NextResponse.next();
    response.headers.set("x-user-id", payload.sub || "");
    response.headers.set("x-user-email", String(payload.email || ""));
    response.headers.set("x-user-admin", String(payload.admin === true));

    console.log("✅ Middleware passed, continuing to page");
    return response;
  } catch (error) {
    console.log("❌ Middleware error:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}