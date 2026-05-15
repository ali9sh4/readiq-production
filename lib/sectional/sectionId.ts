// Stable identifier for a CourseSection. Format: `sec_` + 10 URL-safe chars,
// matching the shape produced by the Phase 1 backfill (e.g. `sec_xXpqKOXosA`).
//
// We don't pull in nanoid as a new direct dependency for one call site —
// node's `crypto.randomBytes` with a custom alphabet gives the same shape with
// ~60 bits of entropy, more than enough to avoid collisions across a course's
// section list.
//
// Phase 5a uses this when the instructor adds a new section in the editor;
// Phase 1's backfill used the same shape via `nanoid(10)`. Keep all future
// section-ID creation routed through here so the format stays consistent.

import { randomBytes } from "crypto";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function mintSectionId(): string {
  const bytes = randomBytes(10);
  let out = "sec_";
  for (let i = 0; i < 10; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
