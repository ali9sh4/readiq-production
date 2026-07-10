// Time-limited course access — shared stamp helpers.
//
// A course may carry `accessDurationDays` (90 | 180 | 365; unset =
// lifetime). Every enrollment-writing purchase path uses these helpers to
// compute the `accessExpiresAt` snapshot so the day math cannot drift
// between paths. Enforcement lives in `evaluateVideoAccess()`
// (lib/courses/videoAccess.ts) — lazy comparison at read time, never a
// mutation at expiry.

export const ACCESS_DURATION_ALLOWED_DAYS = [90, 180, 365] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Reads a course doc's `accessDurationDays` defensively. Any positive
// finite number is honored at stamp time (write boundaries restrict input
// to the allowed set; if corrupt data slips in, stamping proportionally is
// safer than silently granting lifetime).
export function readAccessDurationDays(
  course: Record<string, unknown> | undefined
): number | null {
  const raw = course?.accessDurationDays;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0
    ? raw
    : null;
}

// New purchase: expiry = now + duration.
// Renewal: expiry = max(now, current expiry) + duration — renewing before
// expiry extends from the current expiry, never shortens.
export function computeAccessExpiresAt(
  durationDays: number,
  currentExpiresAt?: string | null
): string {
  const currentMs =
    typeof currentExpiresAt === "string" ? Date.parse(currentExpiresAt) : NaN;
  const baseMs = Number.isFinite(currentMs)
    ? Math.max(Date.now(), currentMs)
    : Date.now();
  return new Date(baseMs + durationDays * MS_PER_DAY).toISOString();
}

// True when an enrollment's stamp exists and has passed. Unset (or
// unparseable) = lifetime — mirrors the "unset accessScope means
// grandfathered" convention.
export function isAccessExpired(
  accessExpiresAt: unknown
): accessExpiresAt is string {
  if (typeof accessExpiresAt !== "string") return false;
  const ms = Date.parse(accessExpiresAt);
  return Number.isFinite(ms) && ms <= Date.now();
}
