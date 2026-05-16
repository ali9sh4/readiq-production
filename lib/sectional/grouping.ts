// Section-aware video grouping (Phase 6a).
//
// Replaces the per-component "group videos by `video.section` free-text
// string" logic that was duplicated in CoursePlayer and CoursePreview.
// New behavior: group by `course.sections[].sectionId` (the canonical FK,
// Phase 5b), fall back to legacy `video.section` title-string match for
// un-migrated rows, and drop the rest into a single "unassigned" bucket.
//
// Pure function — no I/O, no side effects. Both surfaces (player + preview)
// consume the same shape so a future change (e.g. progress badges, per-
// section CTAs) only needs to be written once.

import type { Course, CourseVideo } from "@/types/types";

export type GroupedSection = {
  // null = synthetic "unassigned" bucket (no real section).
  sectionId: string | null;
  title: string;
  order: number;
  videos: CourseVideo[];
};

// Display label for videos that match no real section. Same string the
// legacy code used as the catch-all bucket name, so the UX is unchanged
// for courses that have never been touched by Phase 5b.
const UNASSIGNED_BUCKET_TITLE = "دروس الدورة";

export function groupVideosBySection(
  course: Pick<Course, "sections" | "videos">
): GroupedSection[] {
  const sections = Array.isArray(course.sections) ? course.sections : [];
  const videos = Array.isArray(course.videos) ? course.videos : [];

  const orderedSections = sections.slice().sort((a, b) => a.order - b.order);

  // Initialize one bucket per real section, even if empty — the consumer
  // can choose to hide empty groups.
  const groupsById = new Map<string, GroupedSection>();
  for (const s of orderedSections) {
    groupsById.set(s.sectionId, {
      sectionId: s.sectionId,
      title: s.title,
      order: s.order,
      videos: [],
    });
  }

  // Fallback map for legacy un-migrated videos that carry only the
  // free-text `video.section` string. Trim before matching — older data
  // sometimes has trailing whitespace.
  const titleToSectionId = new Map<string, string>();
  for (const s of orderedSections) {
    if (typeof s.title === "string" && s.title.trim() !== "") {
      titleToSectionId.set(s.title.trim(), s.sectionId);
    }
  }

  const unassignedVideos: CourseVideo[] = [];

  for (const v of videos) {
    // Primary: explicit sectionId pointing at a real section.
    if (typeof v.sectionId === "string" && groupsById.has(v.sectionId)) {
      groupsById.get(v.sectionId)!.videos.push(v);
      continue;
    }
    // Fallback: legacy `video.section` string matching a section title.
    if (typeof v.section === "string" && v.section.trim() !== "") {
      const targetId = titleToSectionId.get(v.section.trim());
      if (targetId) {
        groupsById.get(targetId)!.videos.push(v);
        continue;
      }
    }
    // Final: orphan — sectionId points at a deleted section, or no hints
    // at all.
    unassignedVideos.push(v);
  }

  for (const group of groupsById.values()) {
    group.videos.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const result: GroupedSection[] = orderedSections.map(
    (s) => groupsById.get(s.sectionId)!
  );

  if (unassignedVideos.length > 0) {
    unassignedVideos.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    result.push({
      sectionId: null,
      title: UNASSIGNED_BUCKET_TITLE,
      order: Number.MAX_SAFE_INTEGER,
      videos: unassignedVideos,
    });
  }

  return result;
}
