"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/authContext";

// Refetch this many ms before `expiresAt` so the player never plays a token
// that's about to die. Server TTL is currently 2h; this lets the new token
// land while the old one is still valid.
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

type PlaybackTokenSuccessData = {
  playbackId: string;
  token: string;
  expiresAt: string;
  // Added in Step 3.5.C. Optional here so the type compiles before the
  // server starts returning it.
  thumbnailToken?: string;
};

type PlaybackTokenApiResponse =
  | { success: true; data: PlaybackTokenSuccessData }
  | { success: false; error: { code: string; message: string } };

export type MuxPlaybackTokenError = {
  code: string;
  message: string;
};

export type UseMuxPlaybackTokenArgs = {
  courseId: string;
  videoId: string;
  enabled?: boolean;
};

export type UseMuxPlaybackTokenResult = {
  token: string | null;
  thumbnailToken: string | null;
  playbackId: string | null;
  expiresAt: string | null;
  isLoading: boolean;
  error: MuxPlaybackTokenError | null;
  refetch: () => void;
};

export function useMuxPlaybackToken({
  courseId,
  videoId,
  enabled = true,
}: UseMuxPlaybackTokenArgs): UseMuxPlaybackTokenResult {
  const { user } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [thumbnailToken, setThumbnailToken] = useState<string | null>(null);
  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  // Start `true` when we know we'll fetch on mount, so the first render
  // already reflects the loading state and the consumer never paints a
  // pre-fetch frame. Without this, signed assets briefly try to play
  // unsigned (no `tokens` prop) and the player flashes a 403 before the
  // hook's effect runs.
  const [isLoading, setIsLoading] = useState<boolean>(
    () => enabled && Boolean(courseId) && Boolean(videoId)
  );
  const [error, setError] = useState<MuxPlaybackTokenError | null>(null);

  // Bumping this re-runs the fetch effect. Used by both the public refetch()
  // and the auto-refresh timer.
  const [refetchCounter, setRefetchCounter] = useState(0);
  const refetch = useCallback(() => {
    setRefetchCounter((n) => n + 1);
  }, []);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !user || !courseId || !videoId) {
      setToken(null);
      setThumbnailToken(null);
      setPlaybackId(null);
      setExpiresAt(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/mux/playback-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ courseId, videoId }),
          signal: ac.signal,
        });

        let json: PlaybackTokenApiResponse;
        try {
          json = (await res.json()) as PlaybackTokenApiResponse;
        } catch {
          if (cancelled || ac.signal.aborted) return;
          setToken(null);
          setThumbnailToken(null);
          setPlaybackId(null);
          setExpiresAt(null);
          setError({
            code: "INVALID_RESPONSE",
            message: "Server returned a non-JSON response",
          });
          return;
        }

        if (cancelled || ac.signal.aborted) return;

        if (!json.success) {
          setToken(null);
          setThumbnailToken(null);
          setPlaybackId(null);
          setExpiresAt(null);
          setError(json.error);
          return;
        }

        setToken(json.data.token);
        setThumbnailToken(json.data.thumbnailToken ?? null);
        setPlaybackId(json.data.playbackId);
        setExpiresAt(json.data.expiresAt);
        setError(null);
      } catch (err) {
        if (cancelled || ac.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to fetch playback token";
        setToken(null);
        setThumbnailToken(null);
        setPlaybackId(null);
        setExpiresAt(null);
        setError({ code: "NETWORK_ERROR", message });
      } finally {
        if (!cancelled && !ac.signal.aborted) setIsLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [enabled, user, courseId, videoId, refetchCounter]);

  useEffect(() => {
    if (!enabled || !expiresAt) return;
    const expiryMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiryMs)) return;
    const refreshAt = expiryMs - REFRESH_BEFORE_EXPIRY_MS;
    const delay = Math.max(0, refreshAt - Date.now());
    const id = window.setTimeout(() => {
      setRefetchCounter((n) => n + 1);
    }, delay);
    return () => window.clearTimeout(id);
  }, [enabled, expiresAt]);

  return {
    token,
    thumbnailToken,
    playbackId,
    expiresAt,
    isLoading,
    error,
    refetch,
  };
}
