"use client";

import { useState } from "react";
import { Download, Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/authContext";
import {
  downloadCourseFile,
  viewCourseFile,
} from "@/app/actions/upload_File_actions";
import { CourseFile } from "@/components/fileUplaodtoR2";
import { formatFileSize, getFileIcon } from "./shared";

export default function FilesTab({
  currentVideoFiles,
  generalFiles,
  courseId,
}: {
  currentVideoFiles: CourseFile[];
  generalFiles: CourseFile[];
  courseId: string;
}) {
  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {currentVideoFiles.length === 0 && generalFiles.length === 0 ? (
          <div className="text-center py-12 lg:py-16 bg-white rounded-xl lg:rounded-2xl shadow-md border border-gray-100">
            <div className="bg-gray-50 rounded-full w-16 h-16 lg:w-24 lg:h-24 flex items-center justify-center mx-auto mb-3 lg:mb-4">
              <FileText className="w-8 h-8 lg:w-12 lg:h-12 text-gray-400" />
            </div>
            <p className="text-gray-500 text-base lg:text-lg font-medium">
              لا توجد ملفات متاحة لهذا الدرس
            </p>
            <p className="text-gray-400 text-xs lg:text-sm mt-2">
              سيتم إضافة الملفات والموارد هنا عند توفرها
            </p>
          </div>
        ) : (
          <div className="space-y-4 lg:space-y-6">
            {currentVideoFiles.length > 0 && (
              <div>
                <h4 className="text-xs lg:text-sm font-semibold text-gray-700 mb-3 lg:mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 lg:h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></div>
                  ملفات هذا الدرس
                </h4>
                <div className="space-y-2 lg:space-y-3">
                  {currentVideoFiles.map((file) => (
                    <FileCard key={file.id} file={file} courseId={courseId} />
                  ))}
                </div>
              </div>
            )}

            {generalFiles.length > 0 && (
              <div>
                <h4 className="text-xs lg:text-sm font-semibold text-gray-700 mb-3 lg:mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 lg:h-5 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></div>
                  ملفات عامة للدورة
                </h4>
                <div className="space-y-2 lg:space-y-3">
                  {generalFiles.map((file) => (
                    <FileCard key={file.id} file={file} courseId={courseId} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- File Card Component ---
function FileCard({ file, courseId }: { file: CourseFile; courseId: string }) {
  const auth = useAuth();

  const [error, setError] = useState<string>("");
  const [isViewing, setIsViewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const viewFile = async (filename: string, originalName: string) => {
    if (!auth?.user) {
      toast.error("يرجى تسجيل الدخول لعرض الملفات");
      return;
    }

    setIsViewing(true);
    setError("");

    try {
      const token = await auth.user.getIdToken();

      const result = await viewCourseFile({
        filename,
        courseId,
        token,
      });

      if (result.success && result.url) {
        window.open(result.url, "_blank");
        toast.success("تم فتح الملف");
      } else {
        toast.error(result.error || "فشل في فتح الملف");
        setError(result.error || "فشل في فتح الملف");
      }
    } catch (error) {
      console.error("Error accessing file:", error);
      toast.error("حدث خطأ أثناء فتح الملف");
      setError("حدث خطأ أثناء فتح الملف");
    } finally {
      setIsViewing(false);
    }
  };

  const downloadFile = async (filename: string, originalName: string) => {
    if (!auth?.user) {
      toast.error("يرجى تسجيل الدخول لتحميل الملفات");
      return;
    }

    setIsDownloading(true);
    setError("");

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
        toast.success("تم بدء التحميل");
      } else {
        toast.error(result.error || "فشل في تحميل الملف");
        setError(result.error || "فشل في تحميل الملف");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("حدث خطأ أثناء تحميل الملف");
      setError("حدث خطأ أثناء تحميل الملف");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 lg:p-4 bg-white rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
        <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
          {getFileIcon(file.originalName)}
          <div className="min-w-0">
            <p className="font-medium text-sm lg:text-base truncate">
              {file.originalName}
            </p>
            <p className="text-xs lg:text-sm text-gray-500">
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0">
          <button
            onClick={() => viewFile(file.filename, file.originalName)}
            disabled={isViewing || isDownloading}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50 touch-manipulation"
            title="عرض"
          >
            {isViewing ? (
              <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
            ) : (
              <Eye className="w-4 h-4 lg:w-5 lg:h-5" />
            )}
          </button>
          <button
            onClick={() => downloadFile(file.filename, file.originalName)}
            disabled={isViewing || isDownloading}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50 touch-manipulation"
            title="تحميل"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 lg:w-5 lg:h-5" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-2 p-2 lg:p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs lg:text-sm text-red-600">{error}</p>
        </div>
      )}
    </>
  );
}
