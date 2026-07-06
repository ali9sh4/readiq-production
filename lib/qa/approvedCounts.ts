// Per-lesson approved-pair counts for the practice ("التدريب") entry point —
// Phase 3 slice 1 (docs/AUDIT_STUDY_DECK.md §2, option a).
//
// Count aggregates per video, NOT a maintained counter: §7.3 of
// docs/RUBIK_STUDY_FEATURES.md bans counters on the course doc, and a
// denormalized count would have to be updated by every status transition in
// qa_review_actions.ts plus the importer's migrate path — drift risk for a
// value that costs ~1 read per video to compute fresh (count() bills 1 read
// per 1000 index entries; equality-only filters need no composite index).
//
// The triple predicate (status == approved AND stale == false) matches the
// slice-4 deck read exactly — a migrate can mark an *approved* pair
// stale:true, and students must never see it (invariant 1). `stale` is a
// safe equality filter: the importer writes `stale: false` explicitly on
// every doc it creates or rejoins.

import { db } from "@/firebase/service";

/**
 * Returns approved-pair counts keyed by videoId, for the given course.
 * Videos with zero approved pairs are omitted — consumers read
 * `counts[videoId] ?? 0`.
 *
 * Fail-soft by design: this feeds a UI affordance on the lesson page, so a
 * Firestore error degrades to "no practice tab", never a crashed page.
 */
export async function getApprovedQaCounts(
  courseId: string,
  videoIds: string[]
): Promise<Record<string, number>> {
  const ids = videoIds.filter(
    (id) => typeof id === "string" && id.length > 0
  );
  if (!courseId || ids.length === 0) return {};
  try {
    const qaCol = db.collection("courses").doc(courseId).collection("qa");
    const entries = await Promise.all(
      ids.map(async (videoId) => {
        const snap = await qaCol
          .where("videoId", "==", videoId)
          .where("status", "==", "approved")
          .where("stale", "==", false)
          .count()
          .get();
        return [videoId, snap.data().count] as const;
      })
    );
    return Object.fromEntries(entries.filter(([, count]) => count > 0));
  } catch (err) {
    console.error(
      `getApprovedQaCounts failed courseId=${courseId} (degrading to no practice tab):`,
      err
    );
    return {};
  }
}
