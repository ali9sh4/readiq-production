"use client";

import { useState, useRef } from "react";
import { Video, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useAuth } from "@/context/authContext";

interface Props {
  courseId: string;
  onUploadComplete?: (videoData: any) => void;
  disabled?: boolean;
}

export default function VideoUploader({
  courseId,
  onUploadComplete,
  disabled,
}: Props) {
  const auth = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, startUpload, reset } = useVideoUpload();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith("video/")) {
      alert("Please select a video file");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      // 500MB limit
      alert("Video file too large. Maximum 500MB allowed.");
      return;
    }

    setSelectedFile(file);
    reset();
  };

  const handleUpload = async () => {
    if (!selectedFile || !auth?.user) return;

    try {
      const token = await auth.user.getIdToken();
      await startUpload(selectedFile, courseId, token);
    } catch (error) {
      console.error("Upload failed hhh:", error);
    }
  };

  return (
    <div
      className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg border shadow-sm"
      dir="rtl"
    >
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          رفع فيديو الدورة
        </h3>
        <p className="text-sm text-gray-600">
          الحد الأقصى: 500 ميجا بايت • صيغ مدعومة: MP4, MOV, AVI
        </p>
      </div>

      {/* File Selection */}
      <input
        type="file"
        accept="video/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
        disabled={disabled || state.status !== "idle"}
      />

      {!selectedFile ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-full h-32 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors flex flex-col items-center justify-center gap-3"
        >
          <Video className="w-12 h-12 text-blue-500" />
          <span className="text-blue-700 font-medium">اختر ملف الفيديو</span>
        </button>
      ) : (
        <div className="space-y-4">
          {/* Selected File Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-gray-600">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} ميجا بايت
            </p>
          </div>

          {/* Upload Progress */}
          {state.status !== "idle" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {state.status === "creating" && "جاري التحضير..."}
                  {state.status === "uploading" && "جاري الرفع..."}
                  {state.status === "processing" && "جاري المعالجة..."}
                  {state.status === "ready" && "تم بنجاح!"}
                  {state.status === "error" && "حدث خطأ"}
                </span>
                <span className="text-sm text-gray-600">{state.progress}%</span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {state.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-700">{state.error}</span>
            </div>
          )}

          {/* Success Message */}
          {state.status === "ready" && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-700">تم رفع الفيديو بنجاح!</span>
            </div>
          )}

          {/* Upload Button */}
          {state.status === "idle" && (
            <button
              onClick={handleUpload}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              رفع الفيديو
            </button>
          )}
        </div>
      )}
    </div>
  );
}
