import { z } from "zod";

/**
 * Shared cursor-based pagination query schema.
 * - `limit` defaults to 20, clamped to [1, 100].
 * - `cursor` is the Firestore document id of the last-seen item.
 */
export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;
