// app/course-upload/[courseId]/files/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  FileText,
  Upload,
  Edit,
  Eye,
  EyeOff,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import EnhancedCourseUploader from "@/components/fileUplaodtoR2";
import { saveCourseFiles, getCourseById } from "../../action";

interface UploadedFile {
  filename: string;
  url: string;
  size: number;
  originalName: string;
}

interface Props {
  params: {
    courseId: string;
  };
}

// Prevent back navigation hook
function usePreventBack(warningMessage?: string) {
  useEffect(() => {
    // Replace current history entry to prevent going back
    window.history.replaceState(null, "", window.location.href);

    const handlePopState = () => {
      // Push the current state again to stay on this page
      window.history.pushState(null, "", window.location.href);

      if (warningMessage) {
        alert(warningMessage);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [warningMessage]);
}

export default function CourseFilesUploadPage({ params }: Props) {
  const { courseId } = params;
  const router = useRouter();
  const auth = useAuth();

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [courseData, setCourseData] = useState<any>(null);
  const [showCourseDetails, setShowCourseDetails] = useState(true);
  const [loading, setLoading] = useState(true);

  // Prevent back navigation since course data is already saved
  usePreventBack("لا يمكن العودة للصفحة السابقة. تم حفظ بيانات الدورة بالفعل.");

  // Fetch course details on mount
  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        const response = await getCourseById(courseId);
        if (response.success) {
          setCourseData(response.course);
        }
      } catch (error) {
        console.error("Error fetching course:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]);

  const handleFilesUploaded = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    toast.success(`تم تحميل ${files.length} ملف بنجاح!`, {
      description: "يمكنك الآن إنهاء العملية أو تحميل المزيد من الملفات.",
    });
  };

  const handleComplete = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("يرجى تحميل ملف واحد على الأقل");
      return;
    }

    const token = await auth?.user?.getIdToken();
    if (!token) {
      toast.error("يرجى تسجيل الدخول أولاً");
      return;
    }

    setIsCompleting(true);

    try {
      // Save file URLs to the course record
      const response = await saveCourseFiles({
        courseId,
        files: uploadedFiles,
        token,
      });

      if (response.success) {
        toast.success("تم حفظ ملفات الدورة بنجاح!", {
          description: "تم إنشاء الدورة التدريبية بالكامل.",
        });

        // Use replace to prevent going back
        router.replace(`/dashboard/courses/${courseId}`);
      } else {
        throw new Error(response.message || "فشل في حفظ الملفات");
      }
    } catch (error) {
      console.error("Error saving course files:", error);
      toast.error("حدث خطأ أثناء حفظ الملفات", {
        description: "يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSkip = () => {
    toast.info("تم تخطي تحميل الملفات", {
      description: "يمكنك إضافة الملفات لاحقاً من لوحة التحكم.",
    });
    router.replace(`/dashboard/courses/${courseId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Success Header */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  ✅ تم إنشاء الدورة بنجاح!
                </h1>
                <p className="text-gray-600 mt-1">
                  يمكنك الآن إضافة ملفات الدورة أو مراجعة البيانات وتعديلها
                </p>
              </div>

              {courseData && (
                <Button
                  variant="outline"
                  onClick={() => setShowCourseDetails(!showCourseDetails)}
                  className="flex items-center gap-2"
                >
                  {showCourseDetails ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {showCourseDetails ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Course Summary - Collapsible */}
        {showCourseDetails && courseData && (
          <div className="mb-8">
            <div className="bg-white rounded-lg border shadow-sm">
              <div className="p-6 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">
                    📋 ملخص بيانات الدورة
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.replace(`/course-edit/${courseId}`)}
                    className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <Edit className="w-4 h-4" />
                    تعديل بيانات الدورة
                  </Button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        عنوان الدورة
                      </label>
                      <p className="text-gray-900 font-medium">
                        {courseData.title}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        العنوان الفرعي
                      </label>
                      <p className="text-gray-700">{courseData.subtitle}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          التصنيف
                        </label>
                        <p className="text-gray-700">{courseData.category}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          المستوى
                        </label>
                        <p className="text-gray-700">{courseData.level}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          السعر
                        </label>
                        <p className="text-gray-700">${courseData.price}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          المدة
                        </label>
                        <p className="text-gray-700">
                          {courseData.duration} ساعات
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        وصف الدورة
                      </label>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {courseData.description?.substring(0, 150)}
                        {courseData.description?.length > 150 && "..."}
                      </p>
                    </div>

                    {courseData.learningPoints && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          نقاط التعلم
                        </label>
                        <ul className="text-sm text-gray-700 space-y-1 mt-1">
                          {courseData.learningPoints.slice(0, 3).map(
                            (point: string, index: number) =>
                              point && (
                                <li
                                  key={index}
                                  className="flex items-start gap-2"
                                >
                                  <span className="text-green-600 mt-1">•</span>
                                  <span>{point}</span>
                                </li>
                              )
                          )}
                          {courseData.learningPoints.filter((p: string) => p)
                            .length > 3 && (
                            <li className="text-gray-500 text-xs">
                              وأكثر من ذلك...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        📅 تم الإنشاء:{" "}
                        {new Date(
                          courseData.createdAt?.seconds * 1000
                        ).toLocaleDateString("ar-SA")}
                      </span>
                      <span>🆔 {courseId.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-green-600">
                معلومات الدورة
              </span>
            </div>

            <div className="w-12 h-0.5 bg-gray-300"></div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-blue-600">
                ملفات الدورة
              </span>
            </div>

            <div className="w-12 h-0.5 bg-gray-300"></div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">3</span>
              </div>
              <span className="text-sm text-gray-500">اكتمال</span>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="mb-8">
          <EnhancedCourseUploader
            onUploadComplete={handleFilesUploaded}
            maxFiles={15}
            maxFileSize={100 * 1024 * 1024} // 100MB
          />
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {uploadedFiles.length > 0 ? (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  تم تحميل {uploadedFiles.length} ملف
                </span>
              ) : (
                <span>لم يتم تحميل أي ملفات بعد</span>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={isCompleting}
              >
                تخطي تحميل الملفات
              </Button>

              <Button
                onClick={handleComplete}
                disabled={uploadedFiles.length === 0 || isCompleting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isCompleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    إنهاء وحفظ الدورة
                  </>
                )}
              </Button>
            </div>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                الملفات المحملة:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="text-xs bg-gray-50 p-2 rounded border"
                  >
                    <p
                      className="font-medium truncate"
                      title={file.originalName}
                    >
                      {file.originalName}
                    </p>
                    <p className="text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Options - No Back Button */}
        <div className="mt-8 space-y-4">
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-medium text-gray-800 mb-3">خيارات المتابعة:</h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => router.replace(`/dashboard/courses/${courseId}`)}
                className="flex-1 h-11"
              >
                <FileText className="w-4 h-4 mr-2" />
                إدارة الدورة
              </Button>

              <Button
                variant="outline"
                onClick={() => router.replace("/dashboard")}
                className="flex-1 h-11"
              >
                <Home className="w-4 h-4 mr-2" />
                لوحة التحكم
              </Button>

              <Button
                variant="outline"
                onClick={() => router.replace("/course-upload")}
                className="flex-1 h-11 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                إنشاء دورة جديدة
              </Button>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-blue-600 mt-1">💡</div>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">نصائح مهمة:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>
                    يمكنك تعديل بيانات الدورة في أي وقت من خلال زر تعديل بيانات
                    الدورة
                  </li>
                  <li>
                    • إضافة الملفات اختيارية - يمكن إضافتها لاحقاً من لوحة
                    التحكم
                  </li>
                  <li>• جميع التغييرات محفوظة تلقائياً ولا يمكن التراجع</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
