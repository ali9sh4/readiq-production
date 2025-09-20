import {
  createMuxUpload,
  getMuxAssetStatus,
} from "@/app/actions/upload_viedeo_actions";
import { useState, useCallback } from "react";

export interface VideoUploadState {
  status: "idle" | "creating" | "uploading" | "processing" | "ready" | "error";
  progress: number;
  uploadId?: string;
  assetId?: string;
  playbackId?: string;
  error?: string;
}

export const useVideoUpload = () => {
  const [state, setState] = useState<VideoUploadState>({
    status: "idle",
    progress: 0,
  });

  const startUpload = useCallback(
    async (file: File, courseId: string, token: string) => {
      const POLL_INTERVAL = 5000; // 5 seconds
      const MAX_ATTEMPTS = 20;

      const pollMuxStatus = async (uploadId: string, attempt = 0) => {
        if (attempt >= MAX_ATTEMPTS) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "Mux processing timed out",
          }));
          return;
        }

        try {
          const result = await getMuxAssetStatus(uploadId);

          if (result.success && result.status === "ready") {
            setState((prev) => ({
              ...prev,
              status: "ready",
              playbackId: result.playbackId,
              assetId: uploadId, // Using uploadId as the assetId since result doesn't have assetId
            }));
          } else {
            setTimeout(
              () => pollMuxStatus(uploadId, attempt + 1),
              POLL_INTERVAL
            );
          }
        } catch (error) {
          console.error("Polling error:", error);
          setTimeout(() => pollMuxStatus(uploadId, attempt + 1), POLL_INTERVAL);
        }
      };

      setState({ status: "creating", progress: 0 });

      try {
        // 1. Get upload URL from your server action
        const formData = new FormData();
        formData.append("courseId", courseId);
        formData.append("title", file.name);
        formData.append("token", token);

        const uploadResult = await createMuxUpload(formData);

        if (!uploadResult.success) {
          setState({ status: "error", progress: 0, error: uploadResult.error });
          return;
        }

        const { uploadUrl, uploadId } = uploadResult.data!;
        setState({ status: "uploading", progress: 0, uploadId });

        // 2. Upload directly to Mux with progress tracking
        const xhr = new XMLHttpRequest();

        return new Promise((resolve, reject) => {
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
              resolve(true);
            } else {
              setState({
                status: "error",
                progress: 0,
                error: "Upload failed 111",
              });
              reject(new Error("Upload failed 22 "));
            }
          };

          xhr.onerror = () => {
            setState({ status: "error", progress: 0, error: "Network error" });
            reject(new Error("Network error"));
          };

          xhr.open("PUT", uploadUrl);
          xhr.send(file);
        });
      } catch (error) {
        setState({ status: "error", progress: 0, error: "Upload failed 333" });
        console.error("Upload error:", error);
      }
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
