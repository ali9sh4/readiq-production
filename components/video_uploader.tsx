"use client";
import MuxPlayer from "@mux/mux-player-react";

import { useState, useRef, useEffect } from "react";
import {
  Video,
  Upload,
  AlertCircle,
  CheckCircle,
  X,
  Trash2,
  Loader2,
  Play,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useAuth } from "@/context/authContext";
import {
  getCourseVideos,
  saveCourseVideoToFireStore,
  deleteCourseVideo,
  CourseVideo,
} from "@/app/actions/upload_video_actions";

// ===== INTERFACES =====
interface SelectedVideo {
  file: File;
  id: string;
}

interface Props {
  courseId: string;
  disabled?: boolean;
  maxFileSize?: number;
  maxVideos?: number;
}

// ===== UTILITY FUNCTIONS =====
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "كيلو بايت", "ميجا بايت", "جيجا بايت"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDuration = (seconds?: number): string => {
  if (!seconds) return "---";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatUploadDate = (timestamp?: string): string => {
  if (!timestamp) return "غير محدد";

  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  );

  if (diffInHours < 1) return "منذ أقل من ساعة";
  if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
  if (diffInHours < 48) return "منذ يوم واحد";

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `منذ ${diffInDays} أيام`;

  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// ===== MAIN COMPONENT =====
export default function VideoUploader({
  courseId,
  disabled = false,
  maxFileSize = 500 * 1024 * 1024, // 500MB
  maxVideos = 50,
}: Props) {
  const auth = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, startUpload, reset } = useVideoUpload();

  // ===== STATE =====
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(
    null
  );
  const [previousVideos, setPreviousVideos] = useState<CourseVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [showUploadedVideos, setShowUploadedVideos] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const ALLOWED_TYPES = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
  ];
  useEffect(() => {
    console.log("🔴 About to get token");
    console.log("🔴 handleUpload STARTED"); // Add this first line
  }, [auth?.user, courseId]);

  // ===== LOAD VIDEOS ON MOUNT (Like File Uploader) =====
  useEffect(() => {
    loadPreviousVideos();
  }, [courseId, auth?.user]);

  // ===== LOAD PREVIOUS VIDEOS =====
  const loadPreviousVideos = async () => {
    if (!courseId) return;

    setLoadingVideos(true);
    setError("");

    try {
      const result = await getCourseVideos(courseId);

      if (result.success) {
        const videoList = result.videos || result.videos || [];
        setPreviousVideos(Array.isArray(videoList) ? videoList : []);

        if (videoList.length > 0) {
          setShowUploadedVideos(true);
        }
      } else {
        setPreviousVideos([]);
        if (result.message && !result.message.includes("غير موجودة")) {
          setError(result.message);
        }
      }
    } catch (error) {
      console.error("Error loading videos:", error);
      setPreviousVideos([]);
      setError("حدث خطأ أثناء تحميل الفيديوهات");
    } finally {
      setLoadingVideos(false);
    }
  };

  // ===== VALIDATE VIDEO =====
  const validateVideo = (file: File): string | null => {
    if (!file.type.startsWith("video/")) {
      return "يرجى اختيار ملف فيديو صحيح";
    }

    if (file.size > maxFileSize) {
      return `حجم الملف كبير جداً. الحد الأقصى: ${formatFileSize(maxFileSize)}`;
    }

    if (file.size === 0) {
      return "الملف فارغ";
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return "نوع الفيديو غير مدعوم. الأنواع المسموحة: MP4, MOV, AVI, WEBM";
    }

    // Check if already uploaded
    const isDuplicate = previousVideos.some(
      (v) => v.title === file.name && Math.abs(v.duration || 0) < 1
    );
    if (isDuplicate) {
      return "فيديو بنفس الاسم موجود بالفعل";
    }

    return null;
  };

  // ===== FILE SELECTION =====
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    // Check max videos limit
    if (previousVideos.length >= maxVideos) {
      setError(`تم الوصول للحد الأقصى من الفيديوهات (${maxVideos})`);
      return;
    }

    const validationError = validateVideo(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedVideo({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
    });

    reset();
  };

  // ===== CLEAR SELECTION =====
  const clearSelectedFile = () => {
    setSelectedVideo(null);
    reset();
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ===== UPLOAD VIDEO =====
  const handleUpload = async () => {
    console.log("🔴 handleUpload STARTED"); // Add this first line
    if (!selectedVideo || !auth?.user) {
      setError("يرجى تسجيل الدخول واختيار ملف فيديو");
      return;
    }

    setUploading(true);
    setError("");
    console.log("🔴 About to get token");

    try {
      const token = await auth.user.getIdToken();

      // Start upload to Mux
      const uploadResult = await startUpload(
        selectedVideo.file,
        courseId,
        token
      );
      console.log("Upload result :", uploadResult);
      if (!uploadResult.playbackId) {
        setError("فشل في الحصول على معرف التشغيل من Mux");
        return;
      }

      // Save to Firestore
      const saveResult = await saveCourseVideoToFireStore({
        courseId,
        videoData: [
          {
            assetId: uploadResult.assetId,
            playbackId: uploadResult.playbackId,
            uploadId: uploadResult.uploadId,
            title: selectedVideo.file.name,
            duration: uploadResult.duration,
          },
        ],
        token,
      });
      console.log("Upload result :", uploadResult);

      if (saveResult.success) {
        // Reload video list
        await loadPreviousVideos();
        console.log("Upload result :", uploadResult);

        // Clear selection
        clearSelectedFile();
      } else {
        setError(saveResult.error || "فشل في حفظ بيانات الفيديو");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setError("فشل في رفع الفيديو. يرجى المحاولة مرة أخرى.");
    } finally {
      setUploading(false);
    }
  };

  // ===== DELETE VIDEO =====
  const handleDelete = async (videoId: string, videoTitle: string) => {
    if (!auth?.user) return;

    if (
      !confirm(
        `هل أنت متأكد من حذف الفيديو "${videoTitle}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`
      )
    ) {
      return;
    }

    setDeletingVideoId(videoId);
    setError("");

    try {
      const token = await auth.user.getIdToken();
      const result = await deleteCourseVideo(courseId, videoId, token);

      if (result.success) {
        // Remove from UI
        setPreviousVideos((prev) => prev.filter((v) => v.videoId !== videoId));
      } else {
        setError(result.error || "فشل في حذف الفيديو");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      setError("حدث خطأ أثناء حذف الفيديو");
    } finally {
      setDeletingVideoId(null);
    }
  };

  // ===== PLAY VIDEO =====
  const togglePlayVideo = (videoId: string) => {
    setPlayingVideoId(playingVideoId === videoId ? null : videoId);
  };

  // ===== STATUS HELPERS =====
  const getStatusText = () => {
    switch (state.status) {
      case "creating":
        return "جاري التحضير...";
      case "uploading":
        return "جاري الرفع...";
      case "processing":
        return "جاري المعالجة...";
      case "ready":
        return "تم بنجاح!";
      case "error":
        return "حدث خطأ";
      default:
        return "";
    }
  };

  const getStatusColor = () => {
    switch (state.status) {
      case "error":
        return "text-red-600";
      case "ready":
        return "text-green-600";
      default:
        return "text-blue-600";
    }
  };

  const canSelectMore = previousVideos.length < maxVideos;

  // ===== RENDER =====
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* ===== UPLOAD SECTION ===== */}
      <div className="p-6 bg-white rounded-lg border shadow-sm">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-gray-800">رفع فيديو جديد</h3>

            {/* Refresh Button */}
            <button
              onClick={loadPreviousVideos}
              disabled={loadingVideos || uploading || disabled}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="تحديث الفيديوهات"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingVideos ? "animate-spin" : ""}`}
              />
              تحديث
            </button>
          </div>

          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <p>
              الحد الأقصى: {formatFileSize(maxFileSize)} • صيغ مدعومة: MP4, MOV,
              AVI, WEBM
            </p>
            {previousVideos.length > 0 && (
              <p className="text-green-600 mt-1">
                • يوجد {previousVideos.length} فيديو مرفوع (
                {previousVideos.length}/{maxVideos})
              </p>
            )}
          </div>
        </div>

        {/* Error Message */}
        {(error || state.error) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm flex-1">
                {error || state.error}
              </p>
              <button
                onClick={() => setError("")}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* File Input */}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
          disabled={disabled || state.status !== "idle" || !canSelectMore}
        />

        {!selectedVideo ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || !canSelectMore}
            className="w-full h-32 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors flex flex-col items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Video className="w-12 h-12 text-blue-500" />
            <span className="text-blue-700 font-medium">
              {canSelectMore
                ? "اختر ملف الفيديو"
                : `تم الوصول للحد الأقصى (${maxVideos})`}
            </span>
          </button>
        ) : (
          <div className="space-y-4">
            {/* Selected File */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Video className="w-6 h-6 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {selectedVideo.file.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatFileSize(selectedVideo.file.size)}
                  </p>
                </div>
                {state.status === "idle" && (
                  <button
                    onClick={clearSelectedFile}
                    className="text-gray-500 hover:text-red-500 p-1 flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress */}
            {state.status !== "idle" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${getStatusColor()}`}>
                    {getStatusText()}
                  </span>
                  <span className="text-sm text-gray-600">
                    {state.progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success */}
            {state.status === "ready" && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-medium">
                    تم رفع الفيديو بنجاح!
                  </span>
                </div>
              </div>
            )}

            {/* Upload Button */}
            {state.status === "idle" && (
              <button
                onClick={handleUpload}
                disabled={uploading || disabled}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                <span>{uploading ? "جاري الرفع..." : "رفع الفيديو"}</span>
              </button>
            )}

            {/* Retry */}
            {state.status === "error" && (
              <button
                onClick={() => {
                  reset();
                  setError("");
                }}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                محاولة مرة أخرى
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===== UPLOADED VIDEOS SECTION (Like File Uploader) ===== */}
      {(loadingVideos || previousVideos.length > 0) && (
        <div className="bg-green-50 border border-green-200 rounded-lg">
          {/* Collapsible Header */}
          <button
            onClick={() => setShowUploadedVideos(!showUploadedVideos)}
            disabled={loadingVideos}
            className="w-full p-4 flex items-center justify-between hover:bg-green-100 transition-colors rounded-t-lg disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              {loadingVideos ? (
                <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}

              <h4 className="font-semibold text-green-800">
                {loadingVideos
                  ? "جاري تحميل الفيديوهات..."
                  : `عرض الفيديوهات المرفوعة (${previousVideos.length})`}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {!loadingVideos &&
                (showUploadedVideos ? (
                  <ChevronUp className="w-5 h-5 text-green-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-green-600" />
                ))}
            </div>
          </button>

          {/* Collapsible Content */}
          {showUploadedVideos && !loadingVideos && (
            <div className="px-4 pb-4">
              {previousVideos.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p>لا توجد فيديوهات مرفوعة بعد</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {previousVideos.map((video) => (
                    <div
                      key={video.videoId}
                      className="bg-white rounded-lg border border-green-200 overflow-hidden"
                    >
                      {/* Video Info Row */}
                      <div className="flex items-center gap-4 p-4">
                        {/* Thumbnail */}
                        <div
                          className="relative w-32 h-20 bg-gray-900 rounded overflow-hidden flex-shrink-0 group cursor-pointer"
                          onClick={() => {
                            togglePlayVideo(video.videoId);
                          }}
                        >
                          <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-60 transition-all flex items-center justify-center">
                            <Play className="w-8 h-8 text-white" />
                          </div>
                          {video.duration && (
                            <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">
                              {formatDuration(video.duration)}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate mb-1">
                            {video.title}
                          </h4>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(video.duration)}</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatUploadDate(video.uploadedAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => togglePlayVideo(video.videoId)}
                            className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                            title="تشغيل"
                          >
                            <Play className="w-4 h-4" />
                            <span className="text-xs">تشغيل</span>
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(video.videoId, video.title)
                            }
                            disabled={deletingVideoId === video.videoId}
                            className="flex items-center gap-2 px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="حذف"
                          >
                            {deletingVideoId === video.videoId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            <span className="text-xs">
                              {deletingVideoId === video.videoId
                                ? "جاري الحذف..."
                                : "حذف"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Video Player (Expandable) */}
                      {playingVideoId === video.videoId && (
                        <div className="border-t border-green-200">
                          <div className="aspect-video bg-black">
                            <MuxPlayer
                              playbackId={video.playbackId}
                              streamType="on-demand"
                              metadata={{
                                video_id: video.videoId,
                                video_title: video.title,
                              }}
                              className="w-full aspect-video"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loadingVideos && !selectedVideo && previousVideos.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Video className="w-20 h-20 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">لا توجد فيديوهات</h3>
          <p className="text-sm">اختر فيديو ثم اضغط رفع لبدء التحميل</p>
        </div>
      )}
    </div>
  );
}
