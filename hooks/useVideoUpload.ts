import {
  createMuxUpload,
  getMuxAssetStatus,
} from "@/app/actions/upload_video_actions";
import { createUpload } from "@mux/upchunk";
import { useState, useCallback } from "react";

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
}
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
            setState({
              status: "uploading",
              progress: 0,
              uploadId,
              bytesUploaded: 0,
              totalBytes: file.size,
            });

            // Chunked + resumable upload. UpChunk uploads chunks
            // sequentially by design — no concurrency option exists.
            const upload = createUpload({
              endpoint: uploadUrl,
              file,
              chunkSize: 30720, // KB (30 MB), must be divisible by 256
              attempts: 12,
              // Browsers fire 'online' before the link is actually usable, so
              // instant retries burn all attempts in seconds. 12 × 10s ≈ 2 min
              // of tolerance per chunk (router reboots, ISP blips).
              delayBeforeAttempt: 10,
              dynamicChunkSize: true,
            });

            upload.on("progress", (e) => {
              const progress = Math.round(e.detail);
              setState((prev) => ({
                ...prev,
                progress,
                bytesUploaded: Math.round((e.detail / 100) * file.size),
                isRetrying: false,
              }));
            });

            upload.on("attemptFailure", () => {
              setState((prev) => ({ ...prev, isRetrying: true }));
            });

            upload.on("chunkSuccess", () => {
              setState((prev) => ({ ...prev, isRetrying: false }));
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

  const reset = useCallback(() => {
    setState({ status: "idle", progress: 0 });
  }, []);

  return {
    state,
    startUpload,
    checkProcessingStatus,
    reset,
  };
};
