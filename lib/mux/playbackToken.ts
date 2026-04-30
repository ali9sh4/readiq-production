import { SignJWT, importPKCS8, type KeyLike } from "jose";

const ALGORITHM = "RS256";

let cachedKey: Promise<KeyLike | Uint8Array> | null = null;

function loadSigningKey(): Promise<KeyLike | Uint8Array> {
  if (cachedKey) return cachedKey;

  const privateKey = process.env.MUX_SIGNING_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "Mux signing not configured: MUX_SIGNING_PRIVATE_KEY is not set"
    );
  }

  // Mux exports the signing key as base64-encoded PKCS8. Accept either form:
  //   1) Raw PKCS8 PEM ("-----BEGIN PRIVATE KEY----- ...")
  //   2) Base64-encoded PKCS8 PEM (paste-from-Mux convenience)
  const pem = privateKey.includes("BEGIN")
    ? privateKey.replace(/\\n/g, "\n")
    : Buffer.from(privateKey, "base64").toString("utf8");

  cachedKey = importPKCS8(pem, ALGORITHM);
  return cachedKey;
}

/**
 * Sign a Mux playback JWT for a single playbackId. RS256, aud="v" (video).
 *
 * Lazy validation: env vars are not checked at import time. The first call
 * with missing MUX_SIGNING_KEY_ID / MUX_SIGNING_PRIVATE_KEY throws.
 */
export async function signPlaybackToken({
  playbackId,
  ttlSeconds,
}: {
  playbackId: string;
  ttlSeconds: number;
}): Promise<string> {
  const keyId = process.env.MUX_SIGNING_KEY_ID;
  if (!keyId) {
    throw new Error(
      "Mux signing not configured: MUX_SIGNING_KEY_ID is not set"
    );
  }

  const key = await loadSigningKey();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM, kid: keyId, typ: "JWT" })
    .setSubject(playbackId)
    .setAudience("v")
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key);
}
