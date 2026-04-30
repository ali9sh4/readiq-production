import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/verifyBearerToken";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true as const, data }, init);
}

export function fail(
  code: string,
  message: string,
  status: number
): NextResponse {
  return NextResponse.json(
    { success: false as const, error: { code, message } },
    { status }
  );
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return fail(err.code, err.message, 401);
  }

  if (err instanceof ZodError) {
    const fields = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return NextResponse.json(
      {
        success: false as const,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          fields,
        },
      },
      { status: 400 }
    );
  }

  // Unknown error: log the real cause server-side, return a generic message.
  console.error("[api] unhandled error:", err);
  return fail("INTERNAL_ERROR", "Something went wrong", 500);
}
