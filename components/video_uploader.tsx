"use client";
import MuxPlayer from "@mux/mux-player-react";
import Image from "next/image";

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
  MoveUp,
  MoveDown,
  Edit3,
  Save,
  Gift,
  Eye,
} from "lucide-react";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useAuth } from "@/context/authContext";
import {
  getCourseVideos,
  saveCourseVideoToFireStore,
  deleteCourseVideo,
  reorderCourseVideos,
  updateVideoDetails,
  cleanupVideoCoursePrice,
} from "@/app/actions/upload_video_actions";
import { CourseVideo } from "@/types/types";
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
  const [videoOrder, setVideoOrder] = useState<number | "">(1);
  const [reorderingVideoId, setReorderingVideoId] = useState<string | null>(
    null
  );
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [savingVideoId, setSavingVideoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    section: "",
    isVisible: true,
    isFreePreview: false,
  });
  const ALLOWED_TYPES = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
  ];

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
        const sortedVideos = [...videoList].sort(
          (a, b) => (a.order || 0) - (b.order || 0)
        );
        setPreviousVideos(Array.isArray(sortedVideos) ? sortedVideos : []);
        if (sortedVideos.length > 0) {
          const maxOrder = Math.max(...sortedVideos.map((v) => v.order || 0));
          setVideoOrder(maxOrder + 1);
          setShowUploadedVideos(true);
        } else {
          setVideoOrder(1);
        }
      } else {
        setPreviousVideos([]);
        setVideoOrder(1);
      }
    } catch (error) {
      console.error("Error loading videos:", error);
      setPreviousVideos([]);
      setVideoOrder(1);
    } finally {
      setLoadingVideos(false);
    }
  };
  const handleReorder = async (videoId: string, direction: "up" | "down") => {
    if (!auth?.user) return;

    const currentIndex = previousVideos.findIndex((v) => v.videoId === videoId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= previousVideos.length) return;

    setReorderingVideoId(videoId);
    setError("");

    try {
      const token = await auth.user.getIdToken();
      const result = await reorderCourseVideos(
        courseId,
        videoId,
        newIndex + 1,
        token
      );
      

      if (result.success && result.videos) {
        setPreviousVideos(result.videos);
      } else {
        setError(result.error || "فشل في إعادة الترتيب");
      }
    } catch (error) {
      console.error("Reorder failed:", error);
      setError("حدث خطأ أثناء إعادة الترتيب");
    } finally {
      setReorderingVideoId(null);
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
    if (!courseId) {
      setError("معرف الدورة مفقود");
      return;
    }

    if (!selectedVideo || !auth?.user) {
      setError("يرجى تسجيل الدخول واختيار ملف فيديو");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const token = await auth.user.getIdToken();

      // Start upload to Mux
      const uploadResult = await startUpload(
        selectedVideo.file,
        courseId,
        token
      );
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
            order: videoOrder !== "" ? videoOrder : previousVideos.length + 1,
          },
        ],
        token,
      });

      if (saveResult.success) {
        // Reload video list
        await loadPreviousVideos();

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
  const startEdit = (video: CourseVideo) => {
    setEditForm({
      title: video.title,
      description: video.description || "",
      section: video.section || "",
      isVisible: video.isVisible ?? true,
      isFreePreview: video.isFreePreview ?? false,
    });
    setEditingVideoId(video.videoId);
    setPlayingVideoId(null);
  };

  const cancelEdit = () => {
    setEditingVideoId(null);
  };

  const saveVideoDetails = async (videoId: string) => {
    if (!auth?.user) return;

    setSavingVideoId(videoId);
    try {
      const token = await auth.user.getIdToken();

      // Call your Firebase action here
      const result = await updateVideoDetails(
        courseId,
        videoId,
        editForm,
        token
      );

      if (result.success) {
        // Update local state
        setPreviousVideos((prev) =>
          prev.map((v) => (v.videoId === videoId ? { ...v, ...editForm } : v))
        );
        setEditingVideoId(null);
      } else {
        setError(result.error || "فشل في حفظ التغييرات");
      }
    } catch (error) {
      console.error("Save failed:", error);
      setError("حدث خطأ أثناء الحفظ");
    } finally {
      setSavingVideoId(null);
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
            {/* ⭐ ADD THIS ENTIRE BLOCK */}
            {state.status === "idle" && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ترتيب الفيديو
                </label>
                <input
                  type="text"
                  value={videoOrder}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setVideoOrder("");
                      return;
                    }
                    if (/^\d+$/.test(val)) {
                      setVideoOrder(parseInt(val));
                    }
                  }}
                  onBlur={() => {
                    if (videoOrder === "" || videoOrder < 1) {
                      setVideoOrder(previousVideos.length + 1);
                      return;
                    }
                    const max = previousVideos.length + 1;
                    if (videoOrder > max) {
                      setVideoOrder(max);
                    }
                  }}
                  className="w-full px-4 py-2 border border-blue-300 rounded-lg"
                  placeholder={`الافتراضي: ${previousVideos.length + 1}`}
                />
                <div className="text-xs mt-2">
                  {videoOrder === "" ? (
                    <p className="text-gray-400">أدخل رقم الترتيب</p>
                  ) : videoOrder <= previousVideos.length ? (
                    <p className="text-orange-600">
                      💡 سيتم إدراج الفيديو في الموقع {videoOrder} وتحريك
                      الفيديوهات التالية للأسفل
                    </p>
                  ) : (
                    <p className="text-blue-600">
                      ✓ سيتم إضافة الفيديو في النهاية (الموقع{" "}
                      {previousVideos.length + 1})
                    </p>
                  )}
                </div>
              </div>
            )}

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
                  {previousVideos.map((video, index) => (
                    <div
                      key={video.videoId}
                      className="bg-white rounded-lg border border-green-200 overflow-hidden"
                    >
                      {/* Video Info Row */}
                      <div className="flex items-center gap-4 p-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        {/* Thumbnail */}
                        <div
                          className="relative w-32 h-20 bg-red-500 rounded overflow-hidden flex-shrink-0 group cursor-pointer"
                          onClick={() => {
                            togglePlayVideo(video.videoId);
                          }}
                        >
                          <Image
                            src={`https://image.mux.com/${video.playbackId}/thumbnail.jpg?time=0`}
                            alt={video.title}
                            fill
                            sizes="128px" // Changed - matches w-32 (32 * 4px = 128px)
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-opacity-20 group-hover:bg-opacity-40 transition-all flex items-center justify-center z-10">
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
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleReorder(video.videoId, "up")}
                            disabled={
                              index === 0 || reorderingVideoId === video.videoId
                            }
                            className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-300 hover:border-blue-400"
                            title="تحريك لأعلى"
                          >
                            <MoveUp className="w-6 h-6" />
                          </button>
                          <button
                            onClick={() => handleReorder(video.videoId, "down")}
                            disabled={
                              index === previousVideos.length - 1 ||
                              reorderingVideoId === video.videoId
                            }
                            className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-300 hover:border-blue-400"
                            title="تحريك لأسفل"
                          >
                            <MoveDown className="w-6 h-6" />
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setPlayingVideoId(
                                playingVideoId === video.videoId
                                  ? null
                                  : video.videoId
                              );
                              setEditingVideoId(null);
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                            title="تشغيل"
                          >
                            <Play className="w-4 h-4" />
                            <span className="text-xs">تشغيل</span>
                          </button>

                          <button
                            onClick={() => {
                              if (editingVideoId === video.videoId) {
                                cancelEdit();
                              } else {
                                startEdit(video);
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-md transition-colors"
                            title="تعديل"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span className="text-xs">تعديل</span>
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
                      {/* Edit Form (Expandable) */}
                      {editingVideoId === video.videoId && (
                        <div className="border-t border-green-200 bg-gray-50 p-6">
                          <div className="max-w-3xl space-y-4">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">
                                تعديل تفاصيل الفيديو
                              </h3>
                              {savingVideoId === video.videoId && (
                                <span className="text-sm text-blue-600 flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  جاري الحفظ...
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                عنوان الفيديو *
                              </label>
                              <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    title: e.target.value,
                                  }))
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="أدخل عنوان الفيديو"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                الاسم الأصلي:{" "}
                                {video.originalFilename || video.title}
                              </p>
                            </div>

                            {/* Section */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                القسم / الوحدة
                              </label>
                              <input
                                type="text"
                                value={editForm.section}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    section: e.target.value,
                                  }))
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="مثال: المقدمة، الوحدة الأولى، الخاتمة"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                اختياري - يساعد في تنظيم الفيديوهات
                              </p>
                            </div>

                            {/* Description */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                الوصف
                              </label>
                              <textarea
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                  }))
                                }
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                placeholder="وصف مختصر عن محتوى الفيديو"
                              />
                            </div>

                            {/* Toggles */}
                            <div className="grid grid-cols-2 gap-4">
                              {/* Visibility Toggle - NEW */}
                              <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Eye
                                    className={`w-5 h-5 ${
                                      editForm.isVisible
                                        ? "text-blue-600"
                                        : "text-gray-400"
                                    }`}
                                  />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      مرئي للطلاب
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {editForm.isVisible
                                        ? "الطلاب يمكنهم مشاهدته"
                                        : "مخفي عن الطلاب"}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      isVisible: !prev.isVisible,
                                    }))
                                  }
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    editForm.isVisible
                                      ? "bg-blue-600"
                                      : "bg-gray-300"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      editForm.isVisible
                                        ? "translate-x-6"
                                        : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              </div>
                              {/* Free Preview */}
                              <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Gift
                                    className={`w-5 h-5 ${
                                      editForm.isFreePreview
                                        ? "text-green-600"
                                        : "text-gray-400"
                                    }`}
                                  />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      معاينة مجانية
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {editForm.isFreePreview
                                        ? "متاح للجميع"
                                        : "للمشتركين فقط"}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      isFreePreview: !prev.isFreePreview,
                                    }))
                                  }
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    editForm.isFreePreview
                                      ? "bg-green-600"
                                      : "bg-gray-300"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      editForm.isFreePreview
                                        ? "translate-x-6"
                                        : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 pt-4">
                              <button
                                onClick={() => saveVideoDetails(video.videoId)}
                                disabled={
                                  savingVideoId === video.videoId ||
                                  !editForm.title.trim()
                                }
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Save className="w-4 h-4" />
                                حفظ التغييرات
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={savingVideoId === video.videoId}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                              >
                                <X className="w-4 h-4" />
                                إلغاء
                              </button>
                            </div>
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
