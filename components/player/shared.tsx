import type { ComponentRef } from "react";
import type MuxPlayer from "@mux/mux-player-react";
import { FileText } from "lucide-react";

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

export function getFileIcon(filename: string) {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const colors: Record<string, string> = {
    pdf: "text-red-400",
    doc: "text-blue-400",
    docx: "text-blue-400",
    zip: "text-purple-400",
    mp4: "text-green-400",
    mp3: "text-orange-400",
  };
  return <FileText className={`w-5 h-5 ${colors[ext] || "text-gray-600"}`} />;
}
