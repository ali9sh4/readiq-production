import {
  createMuxUpload,
  getMuxAssetStatus,
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
  // Set when chunks keep failing with nothing committing (degraded link,
  // navigator.onLine still true). The upload is paused; the user resumes
  // or cancels. Committed % is preserved for display while stalled.
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
  // Bytes actually committed (only ever increases) — drives the bar. And the
  // consecutive-failure counter that triggers the stall pause.
  const committedBytesRef = useRef(0);
  const failuresSinceCommitRef = useRef(0);

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

            upload.on("offline", () => {
              setState((prev) => ({ ...prev, isOffline: true }));
            });

            upload.on("online", () => {
              setState((prev) => ({ ...prev, isOffline: false }));
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

  // Resume a stalled upload from the committed point.
  const resume = useCallback(() => {
    failuresSinceCommitRef.current = 0;
    setState((prev) => ({
      ...prev,
      isStalled: false,
      isRetrying: false,
      status: "uploading",
    }));
    uploadRef.current?.resume();
  }, []);

  // Abort a stalled upload and surface the existing failed/error state.
  // Committed progress is preserved (we don't reset the bar to 0).
  const cancel = useCallback(() => {
    uploadRef.current?.abort();
    uploadRef.current = null;
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
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", progress: 0 });
  }, []);

  return {
    state,
    startUpload,
    checkProcessingStatus,
    resume,
    cancel,
    reset,
  };
};
