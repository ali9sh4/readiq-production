import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Cache the JWKS for better performance
const JWKS = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function middleware(request: NextRequest) {
    try {
        const cookie = await cookies();
        const token = cookie.get("firebaseAuthToken")?.value;
        
        if (!token) {
            return NextResponse.redirect(new URL("/", request.url));
        }

        // This is cached and fast after first call
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `https://securetoken.google.com/readiq-1f109`,
            audience: "readiq-1f109",
        });

        if (!payload.admin) {
            return NextResponse.redirect(new URL("/", request.url));
        }

        return NextResponse.next();
        
    } catch (error) {
         console.error("JWT verification failed:", error);
        return NextResponse.redirect(new URL("/", request.url));
       
    }
}
export const config = {
    matcher: [
        '/admin-dashboard',
       
        // Add other protected routes here
    ]
}