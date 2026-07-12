import type { ComponentRef } from "react";
import type MuxPlayer from "@mux/mux-player-react";

// Sentinel React key used for the synthetic "unassigned" bucket, since
// GroupedSection.sectionId is `null` there.
export const UNASSIGNED_KEY = "__unassigned__";

export interface VideoProgress {
  videoId: string;
  completed: boolean;
  watchedSeconds: number;
}

export type MainPlayerHandle = ComponentRef<typeof MuxPlayer>;

export function formatDuration(seconds: number | undefined) {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "كيلو", "ميجا", "جيجا"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Arabic-Indic digits for UI counters (e.g. "٣/٧" in the sidebar).
export function toArabicIndic(n: number) {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

// "N ساعات" / "N دقيقة" label for the sidebar header meta line.
export function formatTotalDuration(totalSeconds: number) {
  if (!totalSeconds) return "٠ دقيقة";
  const hours = totalSeconds / 3600;
  if (hours >= 1) {
    const rounded = Math.round(hours * 10) / 10;
    return `${toArabicIndic(Math.floor(rounded))}${
      rounded % 1 ? "٫٥" : ""
    } ساعات`;
  }
  return `${toArabicIndic(Math.max(1, Math.round(totalSeconds / 60)))} دقيقة`;
}
