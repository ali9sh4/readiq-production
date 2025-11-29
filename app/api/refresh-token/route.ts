import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (request: NextRequest) => {
  const path = request.nextUrl.searchParams.get("redirect");
  if (!path) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("firebaseAuthRefreshToken")?.value;
  if (!refreshToken) {
    return NextResponse.redirect(new URL("/", request.url));
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
      console.error(
        "❌ Firebase refresh failed:",
        response.status,
        await response.text()
      );
      throw new Error("Failed to refresh token");
    }

    const json = await response.json();

    if (!json.id_token || !json.refresh_token) {
      console.error("❌ Invalid response from Firebase:", json);
      throw new Error("Invalid token response");
    }
    console.log("🔄 Token refresh triggered for path:", path);
    const newToken = json.id_token;
    const newRefreshToken = json.refresh_token;
    cookieStore.set("firebaseAuthToken", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });
    cookieStore.set("firebaseAuthRefreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.redirect(new URL(path, request.url));
  } catch (error) {
    console.log("Failed to refresh token", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
};
