import {
  createMuxUpload,
  getMuxAssetStatus,
  cancelMuxUpload,
} from "@/app/actions/upload_video_actions";
import { createUpload } from "@mux/upchunk";
import { useState, useCallback, useRef } from "react";

export interface VideoUploadState {
  status: "idle" | "creating" | "uploading" | "processing" | "ready" | "error";
  progress: number;
  uploadId?: string;
  assetId?: string;
  playbackId?: string;
  error?: string;
  bytesUploaded?: number;
  totalBytes?: number;
  isRetrying?: boolean;
  isOffline?: boolean;
  // Set when the upload can no longer be safely continued — either a degraded
  // link (>= MAX_FAILURES_BEFORE_STALL chunk failures with nothing committing)
  // or a dropped connection (offline). A session that lost its connection
  // can't be completed: resuming re-sends across the partial-chunk seam and
  // Mux rejects the assembled file at finalization. The instance is
  // paused/aborted and the UI shows a restart-fresh prompt; recovery restarts
  // the upload from zero on a new Mux session (resume is intentionally gone).
  isStalled?: boolean;
}

// Pause the upload after this many chunk-attempt failures with no successful
// commit in between. A single transient failure that then commits resets it.
const MAX_FAILURES_BEFORE_STALL = 4;
interface VideoUploadResult {
  assetId: string;
  playbackId: string;
  uploadId: string;
  duration?: number;
}

export const useVideoUpload = () => {
  const [state, setState] = useState<VideoUploadState>({
    status: "idle",
    progress: 0,
  });

  // The live UpChunk instance + the pending promise's reject, so resume()/
  // cancel() can drive it from outside startUpload's closure.
  const uploadRef = useRef<ReturnType<typeof createUpload> | null>(null);
  const rejectRef = useRef<((error: Error) => void) | null>(null);
  // Mux upload id of the current/most-recent session, so a retry can cancel
  // the abandoned one server-side.
  const currentUploadIdRef = useRef<string | null>(null);
  // Bytes actually committed (only ever increases) — drives the bar. And the
  // consecutive-failure counter that triggers the stall pause.
  const committedBytesRef = useRef(0);
  const failuresSinceCommitRef = useRef(0);

  // Tear down any in-flight/abandoned upload before starting a new one (or on
  // explicit cancel). Aborts the old UpChunk instance so it can't auto-resume
  // against a dead URL (the 400 loop + phantom bar creep), best-effort cancels
  // the stale Mux session, and clears the per-upload counters.
  const disposeActiveUpload = useCallback(() => {
    if (uploadRef.current) {
      try {
        uploadRef.current.abort();
      } catch {
        // already aborted/finished — ignore
      }
      uploadRef.current = null;
    }
    const oldId = currentUploadIdRef.current;
    if (oldId) {
      // fire-and-forget; never blocks the new upload, never surfaced to user
      void cancelMuxUpload(oldId).catch(() => {});
      currentUploadIdRef.current = null;
    }
    committedBytesRef.current = 0;
    failuresSinceCommitRef.current = 0;
  }, []);

  const startUpload = useCallback(
    async (
      file: File,
      courseId: string,
      token: string,
    ): Promise<VideoUploadResult> => {
      const POLL_INTERVAL = 10000;
      const MAX_ATTEMPTS = 60;
      return new Promise<VideoUploadResult>((resolveUpload, rejectUpload) => {
        const pollMuxStatus = async (uploadId: string, attempt = 0) => {
          if (attempt >= MAX_ATTEMPTS) {
            setState((prev) => ({
              ...prev,
              status: "error",
              error: "Mux processing timed out",
            }));
            rejectUpload(new Error("Mux processing timed out"));
            return;
          }

          try {
            const result = await getMuxAssetStatus(uploadId);

            if (result.success && result.status === "ready") {
              setState((prev) => ({
                ...prev,
                status: "ready",
                playbackId: result.playbackId,
                assetId: result.assetId,
              }));

              // ✅ Resolve with properly typed data
              resolveUpload({
                assetId: result.assetId!,
                playbackId: result.playbackId!,
                uploadId: uploadId,
                duration: result.duration, // ✅ Also add duration
              });
            } else {
              setTimeout(
                () => pollMuxStatus(uploadId, attempt + 1),
                POLL_INTERVAL,
              );
            }
          } catch (error) {
            console.error("Polling error:", error);
            setTimeout(
              () => pollMuxStatus(uploadId, attempt + 1),
              POLL_INTERVAL,
            );
          }
        };

        setState({ status: "creating", progress: 0 });

        (async () => {
          try {
            // Kill any previous (possibly dead) attempt first, so a retry can
            // never overlap it or reuse its session. Mints a brand-new Mux
            // upload URL below — a fresh empty session where byte 0 is valid.
            disposeActiveUpload();

            const formData = new FormData();
            formData.append("courseId", courseId);
            formData.append("title", file.name);
            formData.append("token", token);

            const uploadResult = await createMuxUpload(formData);

            if (!uploadResult.success) {
              setState({
                status: "error",
                progress: 0,
                error: uploadResult.error,
              });
              rejectUpload(new Error(uploadResult.error));
              return;
            }

            const { uploadUrl, uploadId } = uploadResult.data!;
            // Fresh bookkeeping for this upload.
            committedBytesRef.current = 0;
            failuresSinceCommitRef.current = 0;
            currentUploadIdRef.current = uploadId;
            setState({
              status: "uploading",
              progress: 0,
              uploadId,
              bytesUploaded: 0,
              totalBytes: file.size,
              isRetrying: false,
              isOffline: false,
              isStalled: false,
            });

            // Chunked + resumable upload. UpChunk uploads chunks
            // sequentially by design — no concurrency option exists.
            const upload = createUpload({
              endpoint: uploadUrl,
              file,
              // Fixed 8 MB chunks (KB, multiple of 256). dynamicChunkSize is
              // OFF: it grew the chunk to ~70 MB, so a single failure re-sent
              // ~70 MB and committed nothing. Small fixed chunks give frequent
              // commit points that lock in progress between drops.
              chunkSize: 8192,
              dynamicChunkSize: false,
              attempts: 12,
              // Browsers fire 'online' before the link is actually usable, so
              // instant retries burn all attempts in seconds. 12 × 10s ≈ 2 min
              // of tolerance per chunk (router reboots, ISP blips).
              delayBeforeAttempt: 10,
            });
            uploadRef.current = upload;
            rejectRef.current = rejectUpload;

            // FIX 1: the bar is driven by COMMITTED chunks only, which never
            // decreases. UpChunk's raw "progress" event includes in-flight
            // bytes that collapse to the committed floor on each retry — we
            // deliberately do not subscribe to it.
            upload.on("chunkSuccess", (e) => {
              // chunkSuccess detail carries chunkSize in KB.
              const chunkBytes = (e.detail?.chunkSize ?? 0) * 1024;
              committedBytesRef.current += chunkBytes;
              failuresSinceCommitRef.current = 0;
              const committed = Math.min(committedBytesRef.current, file.size);
              setState((prev) => ({
                ...prev,
                bytesUploaded: committed,
                progress: Math.min(100, Math.round((committed / file.size) * 100)),
                isRetrying: false,
                isStalled: false,
              }));
            });

            // FIX 2B: degraded link — chunks keep failing and none commit.
            // navigator.onLine stays true, so "offline" never fires; the real
            // signal is consecutive attempt failures without a commit.
            upload.on("attemptFailure", () => {
              failuresSinceCommitRef.current += 1;
              if (
                failuresSinceCommitRef.current >= MAX_FAILURES_BEFORE_STALL
              ) {
                upload.pause();
                setState((prev) => ({
                  ...prev,
                  isRetrying: false,
                  isStalled: true,
                }));
              } else {
                setState((prev) => ({ ...prev, isRetrying: true }));
              }
            });

            // FIX: a dropped connection cannot be safely resumed — UpChunk
            // auto-resumes on the next 'online' event and re-sends across the
            // partial-chunk seam, so the assembled bytes no longer match the
            // declared size and Mux rejects the file at finalization (instant
            // fail, no processing). Abort immediately: a dead instance has
            // nothing to auto-resume, and recovery becomes a fresh restart.
            upload.on("offline", () => {
              try {
                upload.abort();
              } catch {
                // already aborted/finished — ignore
              }
              if (uploadRef.current === upload) {
                uploadRef.current = null;
              }
              setState((prev) => ({ ...prev, isStalled: true }));
            });

            upload.on("success", () => {
              setState((prev) => ({
                ...prev,
                status: "processing",
                progress: 100,
                bytesUploaded: file.size,
                isRetrying: false,
                isOffline: false,
                isStalled: false,
              }));
              pollMuxStatus(uploadId);
            });

            upload.on("error", (e) => {
              // Dispose the instance so it can't auto-resume against this dead
              // URL on reconnect (the 400 loop + background bar creep). Keep
              // currentUploadIdRef so the next retry can cancel this session.
              try {
                upload.abort();
              } catch {
                // already aborted/finished — ignore
              }
              if (uploadRef.current === upload) {
                uploadRef.current = null;
              }
              setState({
                status: "error",
                progress: 0,
                error: e.detail?.message || "Upload failed",
              });
              rejectUpload(new Error(e.detail?.message || "Upload failed"));
            });
          } catch (error) {
            setState({ status: "error", progress: 0, error: "Upload failed" });
            console.error("Upload error:", error);
            rejectUpload(error as Error);
          }
        })();
      });
    },
    [],
  );

  const checkProcessingStatus = useCallback(async (assetId: string) => {
    try {
      const result = await getMuxAssetStatus(assetId);

      if (result.success) {
        if (result.status === "ready") {
          setState((prev) => ({
            ...prev,
            status: "ready",
            playbackId: result.playbackId,
            assetId, // This is fine as it's using the passed parameter
          }));
        }
      }
    } catch (error) {
      console.error("Status check failed:", error);
    }
  }, []);

  // There is deliberately no resume(): a session that lost its connection
  // can't be safely completed. Recovery is a fresh restart via startUpload
  // (new Mux url + id, from byte 0) — driven from the component, which holds
  // the selected File.

  // Abort a stalled upload and surface the existing failed/error state.
  // Committed progress is preserved (we don't reset the bar to 0). Also
  // best-effort cancels the abandoned Mux session.
  const cancel = useCallback(() => {
    disposeActiveUpload();
    setState((prev) => ({
      ...prev,
      status: "error",
      isStalled: false,
      isRetrying: false,
      isOffline: false,
      error: "تم إلغاء الرفع",
    }));
    rejectRef.current?.(new Error("Upload cancelled"));
    rejectRef.current = null;
  }, [disposeActiveUpload]);

  const reset = useCallback(() => {
    setState({ status: "idle", progress: 0 });
  }, []);

  return {
    state,
    startUpload,
    checkProcessingStatus,
    cancel,
    reset,
  };
};
