import CourseEditorSkeleton from "@/components/CourseEditorSkeleton";

// Editor-shaped skeleton; without this the segment inherits the parent
// createdCourses grid skeleton, which doesn't match this page's form layout.
export default function Loading() {
  return <CourseEditorSkeleton />;
}
