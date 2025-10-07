import React, { useState, useEffect } from "react";
import {
  Play,
  Clock,
  Calendar,
  Trash2,
  Loader2,
  MoveUp,
  MoveDown,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  Gift,
  Layers,
} from "lucide-react";

// This shows the concept - you'll integrate into your component
export default function EditableVideoCard() {
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [savingVideoId, setSavingVideoId] = useState(null);

  // Sample video data - replace with your actual data
  const [videos, setVideos] = useState([
    {
      videoId: "1",
      playbackId: "abc123",
      title: "مقدمة الكورس.mp4",
      originalFilename: "مقدمة الكورس.mp4",
      description: "",
      section: "",
      duration: 125,
      uploadedAt: new Date().toISOString(),
      isPublished: true,
      isFreePreview: false,
      order: 1,
    },
    {
      videoId: "2",
      playbackId: "def456",
      title: "الدرس الأول.mp4",
      originalFilename: "الدرس الأول.mp4",
      description: "شرح المفاهيم الأساسية",
      section: "الوحدة الأولى",
      duration: 450,
      uploadedAt: new Date(Date.now() - 86400000).toISOString(),
      isPublished: false,
      isFreePreview: true,
      order: 2,
    },
  ]);

  // Local edit state for current video
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    section: "",
    isPublished: true,
    isFreePreview: false,
  });

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatUploadDate = (timestamp) => {
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

  // Start editing
  const startEdit = (video) => {
    setEditForm({
      title: video.title,
      description: video.description || "",
      section: video.section || "",
      isPublished: video.isPublished,
      isFreePreview: video.isFreePreview,
    });
    setEditingVideoId(video.videoId);
    setPlayingVideoId(null); // Close player
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingVideoId(null);
    setEditForm({
      title: "",
      description: "",
      section: "",
      isPublished: true,
      isFreePreview: false,
    });
  };

  // Save changes
  const saveChanges = async (videoId) => {
    setSavingVideoId(videoId);

    // Simulate API call - replace with your Firebase call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update local state
    setVideos((prev) =>
      prev.map((v) => (v.videoId === videoId ? { ...v, ...editForm } : v))
    );

    setSavingVideoId(null);
    setEditingVideoId(null);
  };

  // Auto-save with debounce (optional)
  useEffect(() => {
    if (!editingVideoId) return;

    const timeoutId = setTimeout(() => {
      // Auto-save logic here
      console.log("Auto-saving...", editForm);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [editForm, editingVideoId]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-gray-50" dir="rtl">
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="text-xl font-bold mb-4">
          الفيديوهات المرفوعة ({videos.length})
        </h2>

        <div className="space-y-3">
          {videos.map((video, index) => (
            <div
              key={video.videoId}
              className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:border-blue-300 transition-colors"
            >
              {/* Main Video Info Row */}
              <div className="flex items-center gap-4 p-4">
                {/* Order Number */}
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {video.order}
                </div>

                {/* Thumbnail */}
                <div className="relative w-32 h-20 bg-gray-900 rounded overflow-hidden flex-shrink-0">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white opacity-75" />
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">
                      {formatDuration(video.duration)}
                    </div>
                  )}
                </div>

                {/* Video Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900 truncate">
                      {video.title}
                    </h4>

                    {/* Status Badges */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {video.isFreePreview && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          معاينة مجانية
                        </span>
                      )}
                      {!video.isPublished && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          مسودة
                        </span>
                      )}
                    </div>
                  </div>

                  {video.section && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 mb-1">
                      <Layers className="w-3 h-3" />
                      <span>{video.section}</span>
                    </div>
                  )}

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

                {/* Reorder Buttons */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    disabled={index === 0}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-300"
                    title="تحريك لأعلى"
                  >
                    <MoveUp className="w-5 h-5" />
                  </button>
                  <button
                    disabled={index === videos.length - 1}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-300"
                    title="تحريك لأسفل"
                  >
                    <MoveDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setPlayingVideoId(
                        playingVideoId === video.videoId ? null : video.videoId
                      );
                      setEditingVideoId(null);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span className="text-sm">تشغيل</span>
                  </button>

                  <button
                    onClick={() => startEdit(video)}
                    className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm">تعديل</span>
                  </button>

                  <button className="flex items-center gap-2 px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">حذف</span>
                  </button>
                </div>
              </div>

              {/* Expandable Video Player */}
              {playingVideoId === video.videoId && (
                <div className="border-t border-gray-200 bg-black">
                  <div className="aspect-video flex items-center justify-center text-white">
                    <div className="text-center">
                      <Play className="w-16 h-16 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-75">Mux Player يظهر هنا</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Expandable Edit Form */}
              {editingVideoId === video.videoId && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
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
                        الاسم الأصلي: {video.originalFilename}
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
                      {/* Published Status */}
                      <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          {editForm.isPublished ? (
                            <Eye className="w-5 h-5 text-green-600" />
                          ) : (
                            <EyeOff className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              حالة النشر
                            </p>
                            <p className="text-xs text-gray-500">
                              {editForm.isPublished
                                ? "مرئي للطلاب"
                                : "مخفي (مسودة)"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setEditForm((prev) => ({
                              ...prev,
                              isPublished: !prev.isPublished,
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            editForm.isPublished
                              ? "bg-green-600"
                              : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              editForm.isPublished
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
                        onClick={() => saveChanges(video.videoId)}
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
      </div>
    </div>
  );
}
