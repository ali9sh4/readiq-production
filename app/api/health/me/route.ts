import { NextRequest } from "next/server";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { ok, handleApiError } from "@/lib/api/response";

// TODO: Remove this endpoint before going to production.
// Smoke test for verifyBearerToken + ok/handleApiError. Returns the
// authenticated caller's identity. Not consumed by any production client.
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    return ok(auth);
  } catch (err) {
    return handleApiError(err);
  }
}
