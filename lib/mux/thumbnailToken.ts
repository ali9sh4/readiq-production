import { SignJWT, importPKCS8 } from "jose";

const ALGORITHM = "RS256";

let cachedKey: ReturnType<typeof importPKCS8> | null = null;

function loadSigningKey(): ReturnType<typeof importPKCS8> {
  if (cachedKey) return cachedKey;

  const privateKey = process.env.MUX_SIGNING_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "Mux signing not configured: MUX_SIGNING_PRIVATE_KEY is not set"
    );
  }

  // Mirrors lib/mux/playbackToken.ts. Mux exports the signing key as
  // base64-encoded PKCS8; accept either raw PEM or base64-encoded PEM so
  // env config matches the dashboard's paste-ready format.
  const pem = privateKey.includes("BEGIN")
    ? privateKey.replace(/\\n/g, "\n")
    : Buffer.from(privateKey, "base64").toString("utf8");

  cachedKey = importPKCS8(pem, ALGORITHM);
  return cachedKey;
}

/**
 * Sign a Mux thumbnail JWT for a single playbackId. RS256, aud="t".
 *
 * Same signing key, same library, and same TTL semantics as
 * signPlaybackToken — only the audience differs (aud="t" vs aud="v").
 * Mux validates `aud` per request type, so a playback JWT cannot be
 * used to fetch a thumbnail and vice versa.
 */
export async function signThumbnailToken({
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
    .setAudience("t")
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key);
}
