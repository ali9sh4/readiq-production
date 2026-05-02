"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from "react";
import MuxPlayer from "@mux/mux-player-react";
import { useMuxPlaybackToken } from "@/hooks/useMuxPlaybackToken";

type MuxPlayerProps = ComponentPropsWithoutRef<typeof MuxPlayer>;
type MuxPlayerRef = ComponentRef<typeof MuxPlayer>;

export type SignedMuxPlayerProps = Omit<MuxPlayerProps, "tokens"> & {
  courseId: string;
  videoId: string;
  playbackId?: string | null;
};

const SignedMuxPlayer = forwardRef<MuxPlayerRef, SignedMuxPlayerProps>(
  function SignedMuxPlayer(
    { courseId, videoId, playbackId, ...muxProps },
    ref
  ) {
    const { token, thumbnailToken, error } = useMuxPlaybackToken({
      courseId,
      videoId,
      enabled: Boolean(playbackId),
    });

    if (!playbackId || error?.code === "VIDEO_NOT_READY") {
      return <ProcessingPlaceholder className={muxProps.className} />;
    }

    // Build the tokens object only when at least one signed JWT is available.
    // Legacy public-policy assets (and the brief initial-load window) get no
    // `tokens` prop at all, so MuxPlayer plays them unsigned.
    const muxTokens =
      token || thumbnailToken
        ? {
            ...(token ? { playback: token } : {}),
            ...(thumbnailToken ? { thumbnail: thumbnailToken } : {}),
          }
        : undefined;

    return (
      <MuxPlayer
        {...muxProps}
        ref={ref}
        playbackId={playbackId}
        {...(muxTokens ? { tokens: muxTokens } : {})}
      />
    );
  }
);

function ProcessingPlaceholder({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex aspect-video w-full items-center justify-center bg-neutral-900 text-center text-sm text-neutral-300${
        className ? ` ${className}` : ""
      }`}
    >
      Video is processing — please refresh in a moment.
    </div>
  );
}

export default SignedMuxPlayer;
