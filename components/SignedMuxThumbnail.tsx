"use client";

import Image, { type ImageProps } from "next/image";
import { useMuxPlaybackToken } from "@/hooks/useMuxPlaybackToken";

export type SignedMuxThumbnailProps = Omit<ImageProps, "src"> & {
  courseId: string;
  videoId: string;
  playbackId?: string | null;
  // Frame offset in seconds. Mirrors Mux's ?time= param. Defaults to 0.
  time?: number;
};

export default function SignedMuxThumbnail({
  courseId,
  videoId,
  playbackId,
  time = 0,
  alt,
  ...imageProps
}: SignedMuxThumbnailProps) {
  const { thumbnailToken, error, isLoading } = useMuxPlaybackToken({
    courseId,
    videoId,
    enabled: Boolean(playbackId),
  });

  const isFill = "fill" in imageProps && imageProps.fill === true;

  const showPlaceholder =
    !playbackId ||
    error?.code === "VIDEO_NOT_READY" ||
    (isLoading && !thumbnailToken && !error);

  if (showPlaceholder) {
    const placeholderClassName = [
      imageProps.className,
      "bg-neutral-800 animate-pulse",
      isFill ? "absolute inset-0" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        className={placeholderClassName}
        role="img"
        aria-label={alt}
        style={
          isFill
            ? undefined
            : {
                width: imageProps.width as number | string | undefined,
                height: imageProps.height as number | string | undefined,
              }
        }
      />
    );
  }

  // Token absent + no error = legacy public-policy asset (or, eventually,
  // an explicit "no token needed" signal from the API). Fall back to the
  // unsigned URL so legacy assets keep rendering after the upload-policy
  // flip in 3.5.H.
  const params = new URLSearchParams();
  params.set("time", String(time));
  if (thumbnailToken) params.set("token", thumbnailToken);
  const src = `https://image.mux.com/${playbackId}/thumbnail.jpg?${params.toString()}`;

  return <Image src={src} alt={alt} {...imageProps} />;
}
