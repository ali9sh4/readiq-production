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
  Box,
  Code,
} from "lucide-react";
import {
  deleteCourseFileFromR2,
  downloadCourseFile,
  uploadCourseFileToR2,
  viewCourseFile,
} from "@/app/actions/upload_File_actions";
import {
  saveCourseFilesToFirebase,
  getCourseFiles,
} from "@/app/course-upload/action";
import { useAuth } from "@/context/authContext";
import { deleteCourseFileFromFireStore } from "@/app/course-upload/edit/action";
import { getCourseVideos } from "@/app/actions/upload_video_actions";
import { CourseVideo } from "@/types/types";

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
  relatedVideoId?: string;
}

// ✅ Database CourseFile interface (from existing files)
export interface CourseFile {
  id: string;
  filename: string;
  url?: string; // May exist in old data but we ignore it
  size: number;
  originalName: string;
  uploadedAt: string;
  type: string;
  relatedVideoId?: string;
}

interface Props {
  maxFiles?: number;
  maxFileSize?: number;
  disabled?: boolean;
  id: string;
}

// ===== UTILITY FUNCTIONS =====
const getFileIcon = (filename: string, size: number = 20) => {
  const extension = filename.toLowerCase().split(".").pop() || "";
  const className = `w-${size / 4} h-${size / 4}`;

  // 3D Models
  if (
    ["stl", "obj", "fbx", "blend", "gltf", "glb", "ply"].includes(extension)
  ) {
    return <Box className={`${className} text-purple-500`} />; // Use Box icon from lucide-react
  }

  // Images
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) {
    return <FileImage className={`${className} text-blue-500`} />;
  }

  // Videos
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(extension)) {
    return <FileVideo className={`${className} text-red-500`} />;
  }

  // Audio
  if (["mp3", "wav", "aac", "m4a", "ogg"].includes(extension)) {
    return <FileAudio className={`${className} text-green-500`} />;
  }

  // Documents
  if (
    ["pdf", "doc", "docx", "ppt", "pptx", "txt", "xls", "xlsx"].includes(
      extension
    )
  ) {
    return <FileText className={`${className} text-orange-500`} />;
  }

  // Archives
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return <Archive className={`${className} text-purple-500`} />;
  }

  // Code files
  if (
    ["js", "jsx", "ts", "tsx", "py", "java", "cpp", "css", "html"].includes(
      extension
    )
  ) {
    return <Code className={`${className} text-indigo-500`} />; // Use Code icon from lucide-react
  }

  return <File className={`${className} text-gray-500`} />;
};

const getFileTypeLabel = (filename: string): string => {
  const extension = filename.toLowerCase().split(".").pop() || "";

  const typeMap: Record<string, string> = {
    // Documents
    pdf: "مستند PDF",
    doc: "مستند Word",
    docx: "مستند Word",
    ppt: "عرض تقديمي",
    pptx: "عرض تقديمي",
    xls: "ملف Excel",
    xlsx: "ملف Excel",
    txt: "ملف نصي",
    csv: "ملف CSV",

    // Videos
    mp4: "فيديو",
    webm: "فيديو",
    mov: "فيديو",
    avi: "فيديو",
    mkv: "فيديو",

    // Audio
    mp3: "ملف صوتي",
    wav: "ملف صوتي",
    aac: "ملف صوتي",
    m4a: "ملف صوتي",

    // Images
    jpg: "صورة",
    jpeg: "صورة",
    png: "صورة",
    gif: "صورة متحركة",
    webp: "صورة",
    svg: "صورة متجهة",

    // Archives
    zip: "ملف مضغوط",
    rar: "ملف مضغوط",
    "7z": "ملف مضغوط",
    tar: "ملف مضغوط",
    gz: "ملف مضغوط",

    // 3D Models
    stl: "نموذج 3D (STL)",
    obj: "نموذج 3D (OBJ)",
    fbx: "نموذج 3D (FBX)",
    blend: "ملف Blender",
    gltf: "نموذج 3D (GLTF)",
    glb: "نموذج 3D (GLB)",
    ply: "نموذج 3D (PLY)",
    // Code
    js: "ملف JavaScript",
    jsx: "ملف React",
    ts: "ملف TypeScript",
    tsx: "ملف React TypeScript",
    py: "ملف Python",
    css: "ملف CSS",
    html: "ملف HTML",
    json: "ملف JSON",
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
// In your component

// ===== MAIN COMPONENT =====
export default function SmartCourseUploader({
  maxFiles = 100,
  maxFileSize = 50 * 1024 * 1024,
  id: courseId,
  disabled = false,
}: Props) {
  // ===== STATE =====
  const auth = useAuth();
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
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
  const [courseVideos, setCourseVideos] = useState<CourseVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");

  // ===== CONFIGURATION =====
  // Replace the allowedTypes array (around line 130)
  const allowedTypes = [
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",

    // Videos
    "video/mp4",
    "video/webm",
    "video/quicktime", // .mov
    "video/x-msvideo", // .avi
    "video/x-matroska", // .mkv

    // Audio
    "audio/mpeg", // .mp3
    "audio/wav",
    "audio/x-m4a", // .m4a
    "audio/aac",

    // Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",

    // Archives
    "application/zip",
    "application/x-rar-compressed", // .rar
    "application/x-7z-compressed", // .7z
    "application/x-tar",
    "application/gzip",

    // 🎨 3D Design Files
    "model/stl", // STL files
    "model/ply",
    "application/octet-stream", // ✅ This covers STL, OBJ, FBX, and other binary formats
    "model/obj", // OBJ files
    "model/gltf-binary", // GLB files
    "model/gltf+json", // GLTF files

    // Code Files (for programming courses)
    "text/javascript",
    "text/html",
    "text/css",
    "application/json",
    "application/xml",
  ];
  // Add this function in your component (after allowedTypes)
  const getMaxFileSizeForType = (file: File): number => {
    const extension = file.name.toLowerCase().split(".").pop() || "";

    // 3D Models - Larger limit
    if (
      ["stl", "obj", "fbx", "blend", "gltf", "glb", "ply"].includes(extension)
    ) {
      return 100 * 1024 * 1024; // 100 MB for 3D models
    }

    // Videos - Largest limit
    if (["mp4", "webm", "mov", "avi", "mkv"].includes(extension)) {
      return 200 * 1024 * 1024; // 200 MB for videos
    }

    // Archives - Large limit
    if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
      return 150 * 1024 * 1024; // 150 MB for archives
    }

    // Images - Medium limit
    if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(extension)) {
      return 20 * 1024 * 1024; // 20 MB for images
    }

    // Documents and others - Default
    return 50 * 1024 * 1024; // 50 MB default
  };
  const hasError = () => {
    return error.upload || error.file || error.load;
  };
  const loadPreviousVideo = async () => {
    if (!auth?.user || !courseId) return;
    try {
      const result = await getCourseVideos(courseId);
      if (result.success && result.videos) {
        setCourseVideos(
          result.videos.sort((a, b) => (a.order || 0) - (b.order || 0))
        );
      }
    } catch (error) {
      console.log("error loading videos", error);
    }
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
        // for the developer
        console.error("Failed to load previous files:", result.message);
        // for the user
        // we Don't show error for empty courses - it's normal might be navigation/URL issue
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
    const loadBoth = async () => {
      await loadPreviousVideo(); // Wait for videos
      await loadPreviousFiles(); // Then load files
    };

    if (auth?.user && courseId) {
      loadBoth();
    }
  }, [courseId, auth?.user]);
  useEffect(() => {
    return () => {
      setViewingFiles(new Set());
      setDeletingFiles(new Set());
    };
  }, []);

  // ✅ LOAD FILES ON COMPONENT MOUNT

  // ===== UTILITY FUNCTIONS =====
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 بايت";
    const k = 1024;
    const sizes = ["بايت", "كيلو بايت", "ميجا بايت", "جيجا بايت"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    const maxSize = getMaxFileSizeForType(file); // ✅ Dynamic size based on type

    if (file.size > maxSize) {
      return `الملف كبير جداً. الحد الأقصى: ${formatFileSize(maxSize)}`;
    }

    if (file.size === 0) {
      return "الملف فارغ";
    }

    // ✅ Check file extension for binary files (since MIME type might be generic)
    const extension = file.name.toLowerCase().split(".").pop() || "";
    const allowedExtensions = [
      "pdf",
      "doc",
      "docx",
      "ppt",
      "pptx",
      "xls",
      "xlsx",
      "txt",
      "csv",
      "mp4",
      "webm",
      "mov",
      "avi",
      "mkv",
      "mp3",
      "wav",
      "m4a",
      "aac",
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "svg",
      "zip",
      "rar",
      "7z",
      "tar",
      "gz",
      "stl",
      "obj",
      "fbx",
      "blend",
      "gltf",
      "glb",
      "ply", // ✅ 3D files
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "cpp",
      "css",
      "html",
      "json",
      "xml", // Code files
    ];

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.includes(extension)
    ) {
      return `نوع الملف غير مسموح: ${file.type || extension}`;
    }

    // Check duplicates in selected files
    const isDuplicate = selectedFiles.some(
      (sf) => sf.file.name === file.name && sf.file.size === file.size
    );
    if (isDuplicate) {
      return "الملف موجود بالفعل في القائمة";
    }

    // ... rest of duplicate checks
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
          const result = await uploadCourseFileToR2(formData);
          if (result.success && result.data) {
            const uploadedFile: UploadedFile = {
              filename: result.data.filename,
              size: result.data.size,
              originalName: result.data.metadata.originalName,
              uploadedAt: new Date().toISOString(),
              type: getFileTypeLabel(result.data.metadata.originalName),
              ...(selectedVideoId && { relatedVideoId: selectedVideoId }),
            };

            // 2. Save to database immediately
            const saveResult = await saveCourseFilesToFirebase({
              courseId,
              files: [uploadedFile], // Save one file at a time
              token,
            });
            if (saveResult.success) {
              successCount++;
            } else {
              try {
                console.error(
                  "Failed to save file record to DB FIRESTORE, cleaning up R2:",
                  saveResult.message
                );
                await deleteCourseFileFromR2({
                  filename: uploadedFile.filename,
                  courseId,
                  token,
                });
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
            console.error("Upload to R2 failed:", result.error);
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
        setSelectedVideoId("");
        setSelectedFiles([]); // Clear selected files
        await loadPreviousFiles(); // Refresh the file list
        setShowUploadedFiles(true);
      }
      if (failedFiles.length > 0) {
        setError({
          file: `فشل في رفع بعض الملفات:\n${failedFiles.join("\n")}`,
        });
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
  const removeUploadedFile = async (filename: string, originalName: string) => {
    if (!auth?.user) {
      setError({
        file: "يرجى تسجيل الدخول لحذف الملفات",
      });
      return;
    }

    // Confirm deletion with specific file name
    if (
      !window.confirm(
        `هل أنت متأكد من حذف الملف "${originalName}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`
      )
    ) {
      return;
    }

    // Add filename to deleting state
    setDeletingFiles((prev) => new Set([...prev, filename]));
    setError({}); // Clear any previous errors

    try {
      const token = await auth.user.getIdToken();

      // Delete from R2 storage
      const r2Result = await deleteCourseFileFromR2({
        filename,
        courseId,
        token,
      });

      if (!r2Result.success) {
        throw new Error(`فشل في حذف الملف من التخزين: ${r2Result.error}`);
      }

      // Delete from Firestore database
      const firestoreResult = await deleteCourseFileFromFireStore(
        filename,
        courseId,
        token
      );

      if (!firestoreResult.success) {
        // If Firestore deletion fails but R2 succeeded, we have an inconsistent state
        // Log this for monitoring but don't fail the user operation
        console.error(
          "Firestore deletion failed but R2 succeeded:",
          firestoreResult.error
        );

        // Still show success to user since the file is effectively deleted from storage
        // The Firestore cleanup can be handled separately
      }

      // Refresh the file list to reflect changes
      await loadPreviousFiles();

      // Optional: Show success message briefly
      // You could add a success state if you want to show a temporary success message
    } catch (error) {
      console.error("Error removing file:", error);
      setError({
        file: `فشل في حذف الملف "${originalName}": ${
          error instanceof Error ? error.message : "حدث خطأ غير متوقع"
        }`,
      });
    } finally {
      // Remove filename from deleting state
      setDeletingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
    }
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setUploadedFiles([]);
    setError({});
    setShowUploadedFiles(false);
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
            onClick={() => {
              loadPreviousVideo();
              loadPreviousFiles();
            }}
            disabled={loadingPreviousFiles || uploading || disabled}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            title="تحديث الملفات والفيديوهات"
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
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.webm,.mov,.mp3,.wav,.zip,.rar,.7z,.jpg,.jpeg,.png,.webp,.txt,.stl,.obj,.fbx,.gltf,.glb,.blend,.js,.jsx,.ts,.tsx,.py,.css,.html,.json,.ply"
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
      {/* Video Selector */}
      {selectedFiles.length > 0 && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ربط بفيديو (اختياري)
          </label>
          <select
            onFocus={loadPreviousVideo}
            value={selectedVideoId}
            onChange={(e) => setSelectedVideoId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            disabled={uploading}
          >
            <option value="">بدون ربط - ملفات عامة للدورة</option>
            {courseVideos.map((video, idx) => (
              <option key={video.videoId} value={video.videoId}>
                فيديو #{idx + 1}: {video.title}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            سيظهر الملف تحت الفيديو المحدد. إذا لم تحدد، سيكون متاحاً في قسم
            الملفات العامة
          </p>
        </div>
      )}

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
                          {file.relatedVideoId ? (
                            <span className="text-purple-600 font-medium">
                              مرتبط بالفيديو #
                              {courseVideos.find(
                                (v) => v.videoId === file.relatedVideoId
                              )?.order || "؟"}
                            </span>
                          ) : (
                            <span className="text-gray-400">📁 ملف عام</span>
                          )}
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

                        <button
                          onClick={() =>
                            removeUploadedFile(file.filename, file.originalName)
                          }
                          disabled={
                            deletingFiles.has(file.filename) ||
                            viewingFiles.has(file.filename)
                          }
                          className="flex items-center gap-2 px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="حذف الملف"
                        >
                          {deletingFiles.has(file.filename) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                          <span className="text-xs">
                            {deletingFiles.has(file.filename)
                              ? "جاري الحذف..."
                              : "حذف"}
                          </span>
                        </button>
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
