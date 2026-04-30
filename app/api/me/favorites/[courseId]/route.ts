import { NextRequest } from "next/server";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { handleApiError, ok } from "@/lib/api/response";
import { courseIdPath } from "@/lib/validation/api/favorites";
import { removeFromFavorites } from "@/app/actions/favorites_actions";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ courseId: string }> }
) {
  try {
    const auth = await verifyBearerToken(req);
    const { courseId } = courseIdPath.parse(await ctx.params);

    // Firestore .delete() is a no-op when the doc doesn't exist, so the
    // wrapped server action is already idempotent — calling DELETE on a
    // non-favorited course returns success without an error.
    const result = await removeFromFavorites(auth.token, courseId);
    if (!result.success) {
      console.error(
        "[api/me/favorites DELETE] removeFromFavorites failed:",
        result
      );
      throw new Error(result.error ?? "Failed to remove favorite");
    }

    return ok({ courseId, removed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
