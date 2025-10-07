import {
  createMuxUpload,
  getMuxAssetStatus,
} from "@/app/actions/upload_video_actions";
import { useState, useCallback } from "react";

export interface VideoUploadState {
  status: "idle" | "creating" | "uploading" | "processing" | "ready" | "error";
  progress: number;
  uploadId?: string;
  assetId?: string;
  playbackId?: string;
  error?: string;
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
      token: string
    ): Promise<VideoUploadResult> => {
      const POLL_INTERVAL = 5000; // 5 seconds
      const MAX_ATTEMPTS = 20;
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
                POLL_INTERVAL
              );
            }
          } catch (error) {
            console.error("Polling error:", error);
            setTimeout(
              () => pollMuxStatus(uploadId, attempt + 1),
              POLL_INTERVAL
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
            setState({ status: "uploading", progress: 0, uploadId });

            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const progress = Math.round((e.loaded / e.total) * 100);
                setState((prev) => ({ ...prev, progress }));
              }
            };

            xhr.onload = () => {
              console.log("Upload status:", xhr.status);
              if (xhr.status === 200 || xhr.status === 201) {
                setState((prev) => ({
                  ...prev,
                  status: "processing",
                  progress: 100,
                }));
                pollMuxStatus(uploadId);
              } else {
                setState({
                  status: "error",
                  progress: 0,
                  error: "Upload failed",
                });
                rejectUpload(new Error("Upload failed"));
              }
            };

            xhr.onerror = () => {
              setState({
                status: "error",
                progress: 0,
                error: "Network error",
              });
              rejectUpload(new Error("Network error"));
            };

            xhr.open("PUT", uploadUrl);
            xhr.send(file);
          } catch (error) {
            setState({ status: "error", progress: 0, error: "Upload failed" });
            console.error("Upload error:", error);
            rejectUpload(error as Error);
          }
        })();
      });
    },
    []
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
