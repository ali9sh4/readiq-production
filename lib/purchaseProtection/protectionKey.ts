// lib/idempotency.ts (create this file)
export function generateProtectionKey(
  userId: string,
  courseId: string,
  action: string = "purchase"
): string {
  const timestamp = Date.now();
  return `${action}_${userId}_${courseId}_${timestamp}`;
}
