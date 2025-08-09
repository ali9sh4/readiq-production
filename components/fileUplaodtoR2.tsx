// components/SmartCourseUploader.tsx
"use client";

import { useState, useRef } from "react";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  File,
  Eye,
  Trash2,
} from "lucide-react";
import { uploadCourseFile } from "@/app/actions/upload_actions";

interface SelectedFile {
  file: File;
  id: string;
  error?: string;
}

interface UploadedFile {
  filename: string;
  url: string;
  size: number;
  originalName: string;
}

interface Props {
  onUploadComplete?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  disabled?: boolean;
}

export default function SmartCourseUploader({
  onUploadComplete,
  maxFiles = 5,
  maxFileSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Allowed file types
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `الملف كبير جداً. الحد الأقصى: ${formatFileSize(maxFileSize)}`;
    }

    if (file.size === 0) {
      return "الملف فارغ";
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return `نوع الملف غير مسموح: ${file.type}`;
    }

    // Check for duplicates in selected files
    const isDuplicate = selectedFiles.some(
      (sf) => sf.file.name === file.name && sf.file.size === file.size
    );
    if (isDuplicate) {
      return "الملف موجود بالفعل في القائمة";
    }

    // Check for duplicates in uploaded files
    const isAlreadyUploaded = uploadedFiles.some(
      (uf) => uf.originalName === file.name && uf.size === file.size
    );
    if (isAlreadyUploaded) {
      return "الملف مرفوع بالفعل";
    }

    return null;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setError("");
    const newSelectedFiles: SelectedFile[] = [];
    const errorMessages: string[] = [];

    // Check total limitz   
    const totalFiles =
      selectedFiles.length + uploadedFiles.length + files.length;
    if (totalFiles > maxFiles) {
      setError(`لا يمكن اختيار أكثر من ${maxFiles} ملفات إجمالي`);
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
      setError(errorMessages.join("\n"));
    }

    if (newSelectedFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newSelectedFiles]);
    }

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
    setError("");
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setError("");
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      setError("لا توجد ملفات مختارة للرفع");
      return;
    }

    setUploading(true);
    setError("");
    const newUploadedFiles: UploadedFile[] = [];
    const failedFiles: string[] = [];

    try {
      for (const selectedFile of selectedFiles) {
        try {
          const formData = new FormData();
          formData.append("file", selectedFile.file);

          const result = await uploadCourseFile(formData);

          if (result.success && result.data) {
            const uploadedFile: UploadedFile = {
              filename: result.data.filename,
              url: result.data.url,
              size: result.data.size,
              originalName: result.data.metadata.originalName,
            };
            newUploadedFiles.push(uploadedFile);
          } else {
            failedFiles.push(`${selectedFile.file.name}: ${result.error}`);
          }
        } catch (error) {
          failedFiles.push(`${selectedFile.file.name}: خطأ في الرفع`);
        }
      }

      // Update uploaded files
      if (newUploadedFiles.length > 0) {
        setUploadedFiles((prev) => {
          const updated = [...prev, ...newUploadedFiles];
          if (onUploadComplete) {
            onUploadComplete(updated);
          }
          return updated;
        });

        // Clear selected files that were uploaded successfully
        setSelectedFiles([]);
      }

      // Show errors for failed files
      if (failedFiles.length > 0) {
        setError(`فشل رفع:\n${failedFiles.join("\n")}`);
      }
    } catch (error) {
      setError("حدث خطأ عام أثناء الرفع");
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

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
    setError("");
    if (onUploadComplete) {
      onUploadComplete([]);
    }
  };

  const totalFiles = selectedFiles.length + uploadedFiles.length;
  const canSelectMore = totalFiles < maxFiles;

  return (
    <div
      className="w-full max-w-3xl mx-auto p-6 bg-white rounded-lg border shadow-sm"
      dir="rtl"
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          رفع ملفات الدورة
        </h3>
        <div className="text-sm text-gray-600">
          <p>
            الحد الأقصى: {maxFiles} ملفات • {formatFileSize(maxFileSize)} للملف
            الواحد
          </p>
          <p>الملفات المسموحة: PDF، DOC، PPT، MP4، MP3، ZIP، صور</p>
        </div>
      </div>

      {/* File Selection */}
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
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <File className="w-5 h-5" />
            اختيار الملفات ({totalFiles}/{maxFiles})
          </button>

          {selectedFiles.length > 0 && (
            <button
              onClick={uploadFiles}
              disabled={uploading || disabled}
              className="px-6 h-12 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  جاري الرفع...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  رفع ({selectedFiles.length})
                </>
              )}
            </button>
          )}
        </div>

        {!canSelectMore && (
          <p className="mt-2 text-sm text-amber-600">
            ⚠️ تم الوصول للحد الأقصى من الملفات
          </p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <pre className="text-red-700 text-sm whitespace-pre-wrap">
                {error}
              </pre>
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Selected Files (Waiting to Upload) */}
      {selectedFiles.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-800">
              ملفات مختارة للرفع ({selectedFiles.length})
            </h4>
            <button
              onClick={clearSelectedFiles}
              className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              حذف الكل
            </button>
          </div>

          <div className="space-y-2">
            {selectedFiles.map((selectedFile) => (
              <div
                key={selectedFile.id}
                className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <File className="w-5 h-5 text-blue-600 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">
                    {selectedFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(selectedFile.file.size)} •{" "}
                    {selectedFile.file.type}
                  </p>
                </div>

                <button
                  onClick={() => removeSelectedFile(selectedFile.id)}
                  disabled={uploading}
                  className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-800">
              ملفات مرفوعة ({uploadedFiles.length})
            </h4>
            <button
              onClick={clearAllFiles}
              className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              حذف الكل
            </button>
          </div>

          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <File className="w-5 h-5 text-gray-500 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">
                    {file.originalName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)} • تم الرفع بنجاح
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="عرض الملف"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => removeUploadedFile(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="حذف الملف"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedFiles.length === 0 && uploadedFiles.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <File className="w-16 h-16 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium mb-1">لا توجد ملفات</p>
          <p className="text-sm">اختر الملفات أولاً، ثم اضغط "رفع"</p>
        </div>
      )}

      {/* Summary */}
      {(selectedFiles.length > 0 || uploadedFiles.length > 0) && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              <span>المختارة: {selectedFiles.length}</span>
              <span className="mx-2">•</span>
              <span>المرفوعة: {uploadedFiles.length}</span>
              <span className="mx-2">•</span>
              <span>
                الإجمالي: {totalFiles}/{maxFiles}
              </span>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>جاهز</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
