import { z } from "zod";

export const playbackTokenBody = z.object({
  courseId: z.string().min(1),
  videoId: z.string().min(1),
});

export type PlaybackTokenBody = z.infer<typeof playbackTokenBody>;
