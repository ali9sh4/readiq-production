import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Cache the JWKS for better performance
const JWKS = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function middleware(request: NextRequest) {
    console.log("Middleware running for:", request.url);
    
    try {
        const cookie = await cookies();
        const token = cookie.get("firebaseAuthToken")?.value;
        
        console.log("Token exists:", !!token);
        
        if (!token) {
            console.log("No token, redirecting to home");
            return NextResponse.redirect(new URL("/", request.url));
        }

        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `https://securetoken.google.com/readiq-1f109`,
            audience: "readiq-1f109",
        });

        console.log("Payload:", payload);
        console.log("Is admin:", payload.admin);

        if (!payload.admin) {
            console.log("Not admin, redirecting to home");
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
        '/admin-dashboard/new'
       
        // Add other protected routes here
    ]
}