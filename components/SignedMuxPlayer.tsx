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
    const { token, thumbnailToken, error, isLoading, refetch } =
      useMuxPlaybackToken({
        courseId,
        videoId,
        enabled: Boolean(playbackId),
      });

    if (!playbackId || error?.code === "VIDEO_NOT_READY") {
      return <ProcessingPlaceholder className={muxProps.className} />;
    }

    // Any other token failure (RATE_LIMITED, NETWORK_ERROR, gate denials):
    // rendering MuxPlayer without a `tokens` prop would 403 inside the player
    // chrome as a cryptic broken player. Show a retriable placeholder instead.
    if (error) {
      return (
        <ErrorPlaceholder
          className={muxProps.className}
          code={error.code}
          onRetry={refetch}
        />
      );
    }

    // Initial-load gate. Until the hook reports a token or an error, the
    // wrapper can't tell whether to send a `tokens` prop or omit it.
    // Rendering MuxPlayer here would flash a 403 on signed assets while
    // the JWT is in flight. Holding the placeholder for ~200ms is the
    // cleaner UX.
    if (isLoading && !token && !error) {
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

function ErrorPlaceholder({
  className,
  code,
  onRetry,
}: {
  className?: string;
  code: string;
  onRetry: () => void;
}) {
  const message =
    code === "RATE_LIMITED"
      ? "طلبات كثيرة — انتظر لحظة ثم أعد المحاولة"
      : "تعذّر تحميل الفيديو";
  return (
    <div
      role="alert"
      dir="rtl"
      className={`flex aspect-video w-full flex-col items-center justify-center gap-3 bg-neutral-900 text-center text-sm text-neutral-300${
        className ? ` ${className}` : ""
      }`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-neutral-700 px-4 py-1.5 text-sm text-white transition-colors hover:bg-neutral-600"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

function ProcessingPlaceholder({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      className={`flex aspect-video w-full items-center justify-center bg-neutral-900 text-center text-sm text-neutral-300${
        className ? ` ${className}` : ""
      }`}
    >
      جارٍ تجهيز الفيديو…
    </div>
  );
}

export default SignedMuxPlayer;
