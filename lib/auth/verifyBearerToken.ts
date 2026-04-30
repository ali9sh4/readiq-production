import { adminAuth } from "@/firebase/service";

export type AuthErrorCode =
  | "NO_TOKEN"
  | "INVALID_TOKEN"
  | "EXPIRED_TOKEN"
  | "REVOKED_TOKEN";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status = 401 as const;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export interface VerifiedAuth {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  /**
   * The raw bearer token string. Provided so route handlers can pass it down
   * to existing server actions (e.g. `addToFavorites`) that take a token.
   * Re-extracting from the Authorization header in the caller would work too,
   * but exposing it here keeps that detail in one place.
   */
  token: string;
}

function extractBearer(req: Request): string {
  const header = req.headers.get("authorization");
  if (!header) {
    throw new AuthError("NO_TOKEN", "Missing Authorization header");
  }

  const [scheme, ...rest] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") {
    throw new AuthError("NO_TOKEN", "Authorization scheme must be Bearer");
  }

  const token = rest.join(" ").trim();
  if (!token) {
    throw new AuthError("NO_TOKEN", "Empty bearer token");
  }

  return token;
}

export async function verifyBearerToken(req: Request): Promise<VerifiedAuth> {
  const token = extractBearer(req);

  try {
    // Second arg = checkRevoked. Forces a Firebase Auth round-trip but ensures
    // logged-out / disabled users can't keep using a still-valid ID token.
    const decoded = await adminAuth.verifyIdToken(token, true);

    return {
      userId: decoded.uid,
      email: decoded.email ?? null,
      isAdmin: decoded.admin === true,
      token,
    };
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;

    if (code === "auth/id-token-expired") {
      throw new AuthError("EXPIRED_TOKEN", "ID token has expired");
    }
    if (code === "auth/id-token-revoked") {
      throw new AuthError("REVOKED_TOKEN", "ID token has been revoked");
    }
    throw new AuthError("INVALID_TOKEN", "Invalid ID token");
  }
}
