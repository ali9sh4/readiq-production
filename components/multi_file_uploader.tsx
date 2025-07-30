"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import { Badge } from "./ui/badge";
import { Upload, X, GripVertical, File, AlertCircle } from "lucide-react";

export type FileUpload = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
};

type ValidationError = {
  type: "size" | "type" | "name" | "count" | "duplicate";
  message: string;
  fileName?: string;
};

type Props = {
  files?: FileUpload[];
  onFilesChange: (files: FileUpload[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  accept?: string;
  disabled?: boolean;
  className?: string;
};

// Custom hook for file validation (better testability)
const useFileValidation = (maxFileSize: number, allowedTypes: string[]) => {
  return useCallback(
    (file: File): ValidationError | null => {
      // Sanitize filename to prevent path traversal
      const sanitizedName = file.name.replace(/[<>:"/\\|?*]/g, "_");
      if (sanitizedName !== file.name) {
        return {
          type: "name",
          message: `File "${file.name}" contains invalid characters.`,
          fileName: file.name,
        };
      }

      // Check file size
      if (file.size > maxFileSize) {
        return {
          type: "size",
          message: `File "${
            file.name
          }" is too large. Maximum size is ${formatFileSize(maxFileSize)}.`,
          fileName: file.name,
        };
      }

      // Check file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        return {
          type: "type",
          message: `File "${file.name}" has unsupported type (${file.type}).`,
          fileName: file.name,
        };
      }

      // Additional security: Check for suspicious file extensions
      const suspiciousExtensions = [
        ".exe",
        ".bat",
        ".cmd",
        ".scr",
        ".pif",
        ".com",
      ];
      const extension = file.name
        .toLowerCase()
        .substring(file.name.lastIndexOf("."));
      if (suspiciousExtensions.includes(extension)) {
        return {
          type: "type",
          message: `File "${file.name}" has a potentially dangerous extension.`,
          fileName: file.name,
        };
      }

      return null;
    },
    [maxFileSize, allowedTypes]
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function MultiFileUploader({
  files = [],
  onFilesChange,
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "text/plain",
    "text/csv",
    "application/json",
    "text/javascript",
    "text/css",
    "text/html",
    "application/xml",
  ],
  accept = "*/*",
  disabled = false,
  className = "",
}: Props) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const validateFile = useFileValidation(maxFileSize, allowedTypes);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  // Simple file icon - just use generic File icon for everything
  const getFileIcon = useMemo(() => {
    const FileIconComponent = () => <File className="w-8 h-8 text-blue-600" />;
    FileIconComponent.displayName = "FileIconComponent";
    return FileIconComponent;
  }, []);

  const getFileTypeCategory = useCallback((fileType: string): string => {
    if (fileType.startsWith("image/")) return "صورة";
    if (fileType.startsWith("video/")) return "فيديو";
    if (fileType.startsWith("audio/")) return "صوت";
    if (fileType === "application/pdf") return "PDF";
    if (fileType.includes("word") || fileType.includes("document"))
      return "مستند";
    if (fileType.includes("spreadsheet") || fileType.includes("excel"))
      return "جدول بيانات";
    if (fileType.includes("presentation") || fileType.includes("powerpoint"))
      return "عرض تقديمي";
    if (
      fileType.includes("zip") ||
      fileType.includes("rar") ||
      fileType.includes("archive")
    )
      return "ملف مضغوط";
    if (fileType.startsWith("text/")) return "نص";
    return "ملف";
  }, []);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination || disabled) return;

      const newFiles = Array.from(files);
      const [reorderedItem] = newFiles.splice(result.source.index, 1);
      newFiles.splice(result.destination.index, 0, reorderedItem);

      onFilesChange(newFiles);
    },
    [files, onFilesChange, disabled]
  );

  const checkDuplicate = useCallback(
    (file: File): boolean => {
      return files.some(
        (existingFile) =>
          existingFile.name === file.name &&
          existingFile.size === file.size &&
          existingFile.type === file.type
      );
    },
    [files]
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length === 0) return;

      setIsProcessing(true);
      setErrors([]);

      try {
        const newErrors: ValidationError[] = [];
        const validatedFiles: FileUpload[] = [];

        // Check total count limit first
        if (files.length + selectedFiles.length > maxFiles) {
          newErrors.push({
            type: "count",
            message: `Cannot upload more than ${maxFiles} files. Currently have ${files.length}, trying to add ${selectedFiles.length}.`,
          });
          throw new Error("File count exceeded");
        }

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];

          try {
            // Validate file
            const validationError = validateFile(file);
            if (validationError) {
              newErrors.push(validationError);
              continue;
            }

            // Check for duplicates
            if (checkDuplicate(file)) {
              newErrors.push({
                type: "duplicate",
                message: `الملف "${file.name}" موجود بالفعل وتم تخطيه. لا يمكن إضافة نفس الملف مرتين.`,
                fileName: file.name,
                // Adding a CSS class to increase text size
              });
              continue;
            }

            validatedFiles.push({
              id: `${Date.now()}-${i}-${Math.random()
                .toString(36)
                .substr(2, 9)}`, // Better ID generation
              file,
              name: file.name,
              size: file.size,
              type: file.type,
            });
          } catch (fileError) {
            newErrors.push({
              type: "type",
              message: `Error processing file "${file.name}": ${
                fileError instanceof Error ? fileError.message : "Unknown error"
              }`,
              fileName: file.name,
            });
          }
        }

        // Update files if we have valid ones
        if (validatedFiles.length > 0) {
          onFilesChange([...files, ...validatedFiles]);
        }

        // Set errors if any
        if (newErrors.length > 0) {
          setErrors(newErrors);
        }
      } catch (error) {
        setErrors((prev) => [
          ...prev,
          {
            type: "count",
            message:
              error instanceof Error ? error.message : "An error occurred",
          },
        ]);
      } finally {
        setIsProcessing(false);
        e.target.value = "";
      }
    },
    [files, onFilesChange, maxFiles, validateFile, checkDuplicate]
  );

  const removeFile = useCallback(
    (fileId: string) => {
      onFilesChange(files.filter((file) => file.id !== fileId));
      setErrors([]); // Clear errors when removing files
    },
    [files, onFilesChange]
  );

  const getBadgeText = useCallback((index: number) => {
    if (index === 0) return "الملف الرئيسي";
    if (index === 1) return "ملف ثانوي";
    return `ملف ${index + 1}`;
  }, []);

  const getBadgeVariant = useCallback((index: number) => {
    if (index === 0) return "default" as const;
    if (index === 1) return "secondary" as const;
    return "outline" as const;
  }, []);

  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files]
  );

  const clearAllErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return (
    <div className={`w-full max-w-3xl mx-auto p-4 ${className}`} dir="rtl">
      <input
        type="file"
        multiple
        accept={accept}
        className="hidden"
        ref={uploadInputRef}
        onChange={handleInputChange}
        disabled={isProcessing || disabled}
      />

      <div className="space-y-3 mb-4">
        <Button
          className="w-full h-12 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          type="button"
          disabled={isProcessing || disabled || files.length >= maxFiles}
          onClick={() => {
            uploadInputRef?.current?.click();
          }}
        >
          <Upload className="w-5 h-5 ml-2" />
          {isProcessing
            ? "جاري المعالجة..."
            : `اختر الملفات للتحميل (${files.length}/${maxFiles})`}
        </Button>

        {files.length > 0 && (
          <div className="text-sm text-gray-600 text-center">
            إجمالي الحجم: {formatFileSize(totalSize)}
            {totalSize > maxFileSize && (
              <span className="text-red-500 mr-2">(يتجاوز الحد الأقصى)</span>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Error Display */}
      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-red-700 text-sm font-medium">
                تم العثور على {errors.length} خطأ:
              </p>
            </div>
            <button
              onClick={clearAllErrors}
              className="text-red-600 hover:text-red-800 text-xs"
            >
              مسح الأخطاء
            </button>
          </div>
          <ul className="text-red-700 text-xs space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-red-400">•</span>
                <span>{error.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable
          droppableId="fileUpload"
          direction="vertical"
          isDropDisabled={disabled}
        >
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {files.map((file, index) => (
                <Draggable
                  key={file.id}
                  draggableId={file.id}
                  index={index}
                  isDragDisabled={disabled || isProcessing}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`relative p-3 transition-all duration-200 ${
                        snapshot.isDragging ? "opacity-70 scale-105" : ""
                      }`}
                    >
                      <div className="bg-white rounded-lg flex gap-3 items-center p-4 border-2 border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-200">
                        <div
                          {...provided.dragHandleProps}
                          className={`text-gray-400 hover:text-gray-600 transition-colors ${
                            disabled || isProcessing
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-grab active:cursor-grabbing"
                          }`}
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>

                        <div className="w-16 h-16 flex items-center justify-center rounded-lg border-2 border-gray-200 bg-gray-50">
                          {getFileIcon()}
                        </div>

                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-medium text-gray-800">
                              ملف {index + 1}
                            </p>
                            <Badge
                              variant={getBadgeVariant(index)}
                              className="text-xs"
                            >
                              {getBadgeText(index)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getFileTypeCategory(file.type)}
                            </Badge>
                          </div>

                          <p
                            className="text-sm text-gray-700 truncate mb-1"
                            title={file.name}
                          >
                            {file.name}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{formatFileSize(file.size)}</span>
                            {file.type && (
                              <span
                                className="truncate max-w-32"
                                title={file.type}
                              >
                                {file.type}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => removeFile(file.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                          disabled={isProcessing || disabled}
                          title="حذف الملف"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {files.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <File className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>لم يتم اختيار أي ملفات بعد</p>
          <p className="text-sm">اضغط على زر اختر الملفات لبدء التحميل</p>{" "}
          {/* ✅ Fixed typo */}
        </div>
      )}
    </div>
  );
}
