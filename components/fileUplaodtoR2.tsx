// components/SmartCourseUploader.tsx - With Previous Files Loading
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  File,
  Eye,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Archive,
  Calendar,
  HardDrive,
  RefreshCw,
  Loader,
} from "lucide-react";
import {
  deleteCourseFile,
  downloadCourseFile,
  uploadCourseFile,
  viewCourseFile,
} from "@/app/actions/upload_actions";
import { saveCourseFiles, getCourseFiles } from "@/app/course-upload/action";
import { useAuth } from "@/context/authContext";

// ===== INTERFACES =====
interface SelectedFile {
  file: File;
  id: string;
  error?: string;
}

interface UploadedFile {
  filename: string;
  size: number;
  originalName: string;
  uploadedAt?: string;
  type?: string;
}

// ✅ Database CourseFile interface (from existing files)
export interface CourseFile {
  id: string;
  filename: string;
  url?: string; // May exist in old data but we ignore it
  size: number;
  originalName: string;
  uploadedAt: string;
  order: number;
  type: string;
}

interface Props {
  onUploadComplete?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  disabled?: boolean;
  id: string;
}

// ===== UTILITY FUNCTIONS =====
const getFileIcon = (filename: string, size: number = 20) => {
  const extension = filename.toLowerCase().split(".").pop() || "";
  const className = `w-${size / 4} h-${size / 4}`;

  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) {
    return <FileImage className={`${className} text-blue-500`} />;
  }

  if (["mp4", "webm", "mov", "avi", "mkv"].includes(extension)) {
    return <FileVideo className={`${className} text-red-500`} />;
  }

  if (["mp3", "wav", "aac", "m4a", "ogg"].includes(extension)) {
    return <FileAudio className={`${className} text-green-500`} />;
  }

  if (["pdf", "doc", "docx", "ppt", "pptx", "txt"].includes(extension)) {
    return <FileText className={`${className} text-orange-500`} />;
  }

  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return <Archive className={`${className} text-purple-500`} />;
  }

  return <File className={`${className} text-gray-500`} />;
};

const getFileTypeLabel = (filename: string): string => {
  const extension = filename.toLowerCase().split(".").pop() || "";

  const typeMap: Record<string, string> = {
    pdf: "مستند PDF",
    doc: "مستند Word",
    docx: "مستند Word",
    ppt: "عرض تقديمي",
    pptx: "عرض تقديمي",
    txt: "ملف نصي",
    mp4: "فيديو",
    webm: "فيديو",
    mov: "فيديو",
    avi: "فيديو",
    mp3: "ملف صوتي",
    wav: "ملف صوتي",
    aac: "ملف صوتي",
    jpg: "صورة",
    jpeg: "صورة",
    png: "صورة",
    gif: "صورة متحركة",
    webp: "صورة",
    zip: "ملف مضغوط",
    rar: "ملف مضغوط",
    "7z": "ملف مضغوط",
  };

  return typeMap[extension] || "ملف";
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

  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// ===== MAIN COMPONENT =====
export default function SmartCourseUploader({
  onUploadComplete,
  maxFiles = 100,
  maxFileSize = 50 * 1024 * 1024,
  disabled = false,
  id: courseId,
}: Props) {
  // ===== STATE =====
  const auth = useAuth();

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); // Current session
  const [previousFiles, setPreviousFiles] = useState<CourseFile[]>([]); // ✅ Previous uploads from DB
  const [uploading, setUploading] = useState(false);
  const [loadingPreviousFiles, setLoadingPreviousFiles] = useState(false); // ✅ Loading state
  const [error, setError] = useState<{
    upload?: string;
    load?: string;
    file?: string;
  }>({});
  const [viewingFiles, setViewingFiles] = useState<Set<string>>(new Set());
  const [showUploadedFiles, setShowUploadedFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== CONFIGURATION =====
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
    "application/zip",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
  ];
  const hasError = () => {
    return error.upload || error.file || error.load;
  };

  // ✅ LOAD PREVIOUS FILES FROM DATABASE
  const loadPreviousFiles = async () => {
    if (!auth?.user || !courseId) return;

    setLoadingPreviousFiles(true);
    setError({});

    try {
      const result = await getCourseFiles(courseId);

      if (result.success && result.files) {
        setPreviousFiles(result.files);

        // Auto-expand if there are files to show
        if (result.files.length > 0) {
          setShowUploadedFiles(true);
        }
      } else {
        console.error("Failed to load previous files:", result.message);
        // Don't show error for empty courses - it's normal
        if (result.message && !result.message.includes("غير موجودة")) {
          setError({
            load: "فشل في تحميل الملفات السابقة. يرجى المحاولة مرة أخرى.",
          });
        }
      }
    } catch (error) {
      console.error("Error loading previous files:", error);
      setError({
        load: "حدث خطأ أثناء تحميل الملفات السابقة. يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setLoadingPreviousFiles(false);
    }
  };

  useEffect(() => {
    return () => {
      setViewingFiles(new Set());
    };
  }, []);

  // ✅ LOAD FILES ON COMPONENT MOUNT
  useEffect(() => {
    loadPreviousFiles();
  }, [courseId, auth?.user]);

  // ===== UTILITY FUNCTIONS =====
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 بايت";
    const k = 1024;
    const sizes = ["بايت", "كيلو بايت", "ميجا بايت", "جيجا بايت"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `الملف كبير جداً. الحد الأقصى: ${formatFileSize(maxFileSize)}`;
    }

    if (file.size === 0) {
      return "الملف فارغ";
    }

    if (!allowedTypes.includes(file.type)) {
      return `نوع الملف غير مسموح: ${file.type}`;
    }

    // Check duplicates in selected files
    const isDuplicate = selectedFiles.some(
      (sf) => sf.file.name === file.name && sf.file.size === file.size
    );
    if (isDuplicate) {
      return "الملف موجود بالفعل في القائمة";
    }

    // Check duplicates in current session uploads
    const isAlreadyUploaded = uploadedFiles.some(
      (uf) => uf.originalName === file.name && uf.size === file.size
    );
    if (isAlreadyUploaded) {
      return "الملف مرفوع بالفعل في هذه الجلسة";
    }

    // ✅ Check duplicates in previous files from database
    const isInPreviousFiles = previousFiles.some(
      (pf) => pf.originalName === file.name && pf.size === file.size
    );
    if (isInPreviousFiles) {
      return "الملف موجود بالفعل في الدورة";
    }

    return null;
  };

  // ===== FILE SELECTION HANDLERS =====
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setError({});
    const newSelectedFiles: SelectedFile[] = [];
    const errorMessages: string[] = [];

    // ✅ Include previous files in total count
    const totalExistingFiles = uploadedFiles.length + previousFiles.length;
    const totalFiles = selectedFiles.length + totalExistingFiles + files.length;

    if (totalFiles > maxFiles) {
      setError({
        upload: `تجاوز الحد الأقصى للملفات المسموحة (${maxFiles} ملفات)`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    files.forEach((file) => {
      const validationError = validateFile(file);

      if (validationError) {
        errorMessages.push(`${file.name}: ${validationError}`);
      } else {
        newSelectedFiles.push({
          file,
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
        });
      }
    });

    if (errorMessages.length > 0) {
      setError({
        upload: errorMessages.join("\n"),
      });
    }

    if (newSelectedFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newSelectedFiles]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setError({});
  };

  // ===== UPLOAD HANDLERS =====
  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      setError({
        upload: "لا توجد ملفات للرفع",
      });
      return;
    }

    if (!auth?.user) {
      setError({
        upload: "يرجى تسجيل الدخول لرفع الملفات",
      });
      return;
    }

    setUploading(true);
    setError({});
    const failedFiles: string[] = [];
    let successCount = 0;

    try {
      for (const selectedFile of selectedFiles) {
        try {
          const token = await auth.user.getIdToken();
          const formData = new FormData();
          formData.append("file", selectedFile.file);
          formData.append("courseId", courseId);
          formData.append("token", token);

          // 1. Upload to R2
          const result = await uploadCourseFile(formData);

          if (result.success && result.data) {
            const uploadedFile: UploadedFile = {
              filename: result.data.filename,
              size: result.data.size,
              originalName: result.data.metadata.originalName,
              uploadedAt: new Date().toISOString(),
              type: getFileTypeLabel(result.data.metadata.originalName),
            };

            // 2. Save to database immediately
            const saveResult = await saveCourseFiles({
              courseId,
              files: [uploadedFile], // Save one file at a time
              token,
            });

            if (saveResult.success) {
              // ✅ Success - both R2 and database updated
              successCount++;
              console.log(
                `✅ Successfully uploaded: ${selectedFile.file.name}`
              );
            } else {
              // ❌ Database save failed - cleanup R2 file
              console.log(
                `Database save failed for ${uploadedFile.filename}, cleaning up R2...`
              );

              try {
                const deleteResult = await deleteCourseFile(
                  uploadedFile.filename
                );

                if (deleteResult.success) {
                  console.log(
                    `✅ Successfully cleaned up orphaned file: ${uploadedFile.filename}`
                  );
                } else {
                  console.error(
                    `❌ Failed to cleanup orphaned file: ${uploadedFile.filename}`,
                    deleteResult.error
                  );
                  // This creates an orphan - very rare
                }
              } catch (cleanupError) {
                console.error(
                  `❌ Cleanup error for ${uploadedFile.filename}:`,
                  cleanupError
                );
                // This creates an orphan - very rare
              }

              failedFiles.push(
                `${selectedFile.file.name}: ${saveResult.message}`
              );
            }
          } else {
            // R2 upload failed - no cleanup needed
            failedFiles.push(`${selectedFile.file.name}: ${result.error}`);
          }
        } catch (error) {
          console.error(
            "Upload error for file:",
            selectedFile.file.name,
            error
          );
          failedFiles.push(`${selectedFile.file.name}: خطأ في الرفع`);
        }
      }

      // ✅ Handle results based on individual file processing
      if (successCount > 0) {
        setSelectedFiles([]); // Clear selected files
        await loadPreviousFiles(); // Refresh the file list
        setShowUploadedFiles(true);
      }

      if (failedFiles.length > 0) {
        setError({
          file: `فشل في رفع بعض الملفات:\n${failedFiles.join("\n")}`,
        });
      }

      // ✅ Show summary
      if (successCount > 0 && failedFiles.length > 0) {
        console.log(
          `Upload completed: ${successCount} successful, ${failedFiles.length} failed`
        );
      }
    } catch (error) {
      setError({
        upload: "حدث خطأ أثناء رفع الملفات",
      });
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };
  // ===== FILE ACCESS HANDLERS =====
  const viewFile = async (filename: string, originalName: string) => {
    if (!auth?.user) {
      setError({
        file: "يرجى تسجيل الدخول لعرض الملفات",
      });
      return;
    }

    setViewingFiles((prev) => new Set([...prev, filename]));

    try {
      const token = await auth.user.getIdToken();

      const result = await viewCourseFile({
        filename,
        courseId,
        token,
      });

      if (result.success && result.url) {
        window.open(result.url, "_blank");
      } else {
        setError({
          file: `فشل في فتح الملف: ${result.error}`,
        });
      }
    } catch (error) {
      console.error("Error accessing file:", error);
      setError({
        file: `حدث خطأ أثناء فتح الملف: ${originalName}`,
      });
    } finally {
      setViewingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
    }
  };

  const downloadFile = async (filename: string, originalName: string) => {
    if (!auth?.user) {
      setError({
        file: "يرجى تسجيل الدخول لتحميل الملفات",
      });
      return;
    }

    setViewingFiles((prev) => new Set([...prev, filename]));

    try {
      const token = await auth.user.getIdToken();

      const result = await downloadCourseFile({
        filename,
        courseId,
        token,
      });

      if (result.success && result.url) {
        const link = document.createElement("a");
        link.href = result.url;
        link.download = originalName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError({
          file: `فشل في تحميل الملف: ${result.error}`,
        });
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      setError({
        file: `حدث خطأ أثناء تحميل الملف: ${originalName}`,
      });
    } finally {
      setViewingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
    }
  };

  // ===== FILE MANAGEMENT HANDLERS =====
  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (onUploadComplete) {
        onUploadComplete(updated);
      }
      return updated;
    });
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setUploadedFiles([]);
    setError({});
    setShowUploadedFiles(false);
    if (onUploadComplete) {
      onUploadComplete([]);
    }
  };

  // ===== COMPUTED VALUES =====
  const totalExistingFiles = uploadedFiles.length + previousFiles.length;
  const totalFiles = selectedFiles.length + totalExistingFiles;
  const canSelectMore = totalFiles < maxFiles;
  const allUploadedFiles = [...previousFiles, ...uploadedFiles]; // ✅ Combine all files

  // ===== RENDER =====
  return (
    <div
      className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg border shadow-sm"
      dir="rtl"
    >
      {/* ===== HEADER ===== */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-800">
            مركز إدارة ملفات الدورة
          </h3>

          {/* ✅ Refresh Button */}
          <button
            onClick={loadPreviousFiles}
            disabled={loadingPreviousFiles || uploading || disabled}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            title="تحديث الملفات"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loadingPreviousFiles ? "animate-spin" : ""
              }`}
            />
            تحديث
          </button>
        </div>

        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4" />
            <span>
              الحد الأقصى: {maxFiles} ملفات • {formatFileSize(maxFileSize)}{" "}
              للملف الواحد
            </span>
            {totalExistingFiles > 0 && (
              <span className="text-green-600">
                • يوجد {totalExistingFiles} ملف مرفوع
              </span>
            )}
          </div>
          <p>الملفات المسموحة: PDF، DOC، PPT، MP4، MP3، ZIP، صور</p>
        </div>
      </div>

      {/* ===== FILE SELECTION ===== */}
      <div className="mb-6">
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.webm,.mp3,.wav,.zip,.jpg,.jpeg,.png,.webp,.txt"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
          disabled={uploading || disabled || !canSelectMore}
        />

        <div className="flex gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || disabled || !canSelectMore}
            className="flex-1 h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
          >
            <File className="w-6 h-6" />
            <span>
              اختيار الملفات ({totalFiles}/{maxFiles})
            </span>
          </button>

          {selectedFiles.length > 0 && (
            <button
              onClick={uploadFiles}
              disabled={uploading || disabled}
              className="px-8 h-14 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-3 shadow-lg"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  <span>جاري الرفع...</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  <span>رفع ({selectedFiles.length})</span>
                </>
              )}
            </button>
          )}
        </div>

        {!canSelectMore && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              ⚠️ تم الوصول للحد الأقصى من الملفات ({maxFiles} ملفات)
            </p>
          </div>
        )}
      </div>

      {/* ===== ERROR MESSAGE ===== */}
      {hasError() && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-800 mb-1">حدث خطأ</h4>
              <pre className="text-red-700 text-sm whitespace-pre-wrap">
                {error.upload || error.load || error.file}
              </pre>
            </div>
            <button
              onClick={() => setError({})}
              className="text-red-600 hover:text-red-800 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ===== SELECTED FILES (WAITING TO UPLOAD) ===== */}
      {selectedFiles.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-blue-800 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              ملفات في انتظار الرفع ({selectedFiles.length})
            </h4>
            <button
              onClick={clearSelectedFiles}
              className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1 px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              حذف الكل
            </button>
          </div>

          <div className="space-y-3">
            {selectedFiles.map((selectedFile) => (
              <div
                key={selectedFile.id}
                className="flex items-center gap-4 p-3 bg-white border border-blue-200 rounded-lg"
              >
                {getFileIcon(selectedFile.file.name, 20)}

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {selectedFile.file.name}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span>{formatFileSize(selectedFile.file.size)}</span>
                    <span>•</span>
                    <span>{getFileTypeLabel(selectedFile.file.name)}</span>
                  </div>
                </div>

                <button
                  onClick={() => removeSelectedFile(selectedFile.id)}
                  disabled={uploading}
                  className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✅ ===== ALL UPLOADED FILES SECTION (PREVIOUS + CURRENT) ===== */}
      {(loadingPreviousFiles || allUploadedFiles.length > 0) && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg">
          {/* ✅ Collapsible Header */}
          <button
            onClick={() => setShowUploadedFiles(!showUploadedFiles)}
            disabled={loadingPreviousFiles}
            className="w-full p-4 flex items-center justify-between hover:bg-green-100 transition-colors rounded-t-lg disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              {loadingPreviousFiles ? (
                <Loader className="w-6 h-6 text-green-600 animate-spin" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}

              <h4 className="font-semibold text-green-800">
                {loadingPreviousFiles
                  ? "جاري تحميل الملفات..."
                  : `عرض الملفات المرفوعة (${allUploadedFiles.length})`}
              </h4>

              {!loadingPreviousFiles && allUploadedFiles.length > 0 && (
                <span className="px-2 py-1 bg-green-200 text-green-800 text-xs rounded-full">
                  {formatFileSize(
                    allUploadedFiles.reduce((sum, file) => sum + file.size, 0)
                  )}{" "}
                  إجمالي
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {allUploadedFiles.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAllFiles();
                  }}
                  className="text-sm text-red-600 hover:text-red-800 px-3 py-1 rounded-md hover:bg-red-100 transition-colors"
                >
                  حذف الكل
                </button>
              )}

              {!loadingPreviousFiles &&
                (showUploadedFiles ? (
                  <ChevronUp className="w-5 h-5 text-green-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-green-600" />
                ))}
            </div>
          </button>

          {/* ✅ Collapsible Content */}
          {showUploadedFiles && !loadingPreviousFiles && (
            <div className="px-4 pb-4">
              {allUploadedFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <File className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>لا توجد ملفات مرفوعة لهذه الدورة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allUploadedFiles.map((file, index) => (
                    <div
                      key={`${file.filename}-${index}`}
                      className="flex items-center gap-4 p-4 bg-white border border-green-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      {getFileIcon(file.originalName, 24)}

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate mb-1">
                          {file.originalName}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            <span>{formatFileSize(file.size)}</span>
                          </div>
                          <span>•</span>
                          <span>
                            {file.type || getFileTypeLabel(file.originalName)}
                          </span>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatUploadDate(file.uploadedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* ✅ View Button */}
                        <button
                          onClick={() =>
                            viewFile(file.filename, file.originalName)
                          }
                          disabled={viewingFiles.has(file.filename)}
                          className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md disabled:opacity-50 transition-colors"
                          title="عرض الملف"
                        >
                          {viewingFiles.has(file.filename) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                          <span className="text-xs">عرض</span>
                        </button>

                        {/* ✅ Download Button */}
                        <button
                          onClick={() =>
                            downloadFile(file.filename, file.originalName)
                          }
                          disabled={viewingFiles.has(file.filename)}
                          className="flex items-center gap-2 px-3 py-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md disabled:opacity-50 transition-colors"
                          title="تحميل الملف"
                        >
                          {viewingFiles.has(file.filename) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span className="text-xs">تحميل</span>
                        </button>

                        {/* Only allow removing current session files, not previous ones */}
                        {index >= previousFiles.length && (
                          <button
                            onClick={() =>
                              removeUploadedFile(index - previousFiles.length)
                            }
                            className="flex items-center gap-2 px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                            title="حذف الملف"
                          >
                            <X className="w-4 h-4" />
                            <span className="text-xs">حذف</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== EMPTY STATE ===== */}
      {!loadingPreviousFiles &&
        selectedFiles.length === 0 &&
        allUploadedFiles.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <File className="w-20 h-20 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">لا توجد ملفات</h3>
            <p className="text-sm">
              اختر الملفات أولاً، ثم اضغط رفع لبدء التحميل
            </p>
          </div>
        )}

      {/* ===== SUMMARY ===== */}
      {(selectedFiles.length > 0 || allUploadedFiles.length > 0) && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
              <span className="font-medium">الملخص:</span>
              <span className="mx-2">المختارة: {selectedFiles.length}</span>
              <span className="mx-2">•</span>
              <span className="mx-2">المرفوعة: {allUploadedFiles.length}</span>
              <span className="mx-2">•</span>
              <span>
                الإجمالي: {totalFiles}/{maxFiles}
              </span>
            </div>

            {allUploadedFiles.length > 0 && (
              <div className="flex items-center gap-2 text-green-600 bg-green-100 px-4 py-2 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">جاهز للمشاهدة</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
