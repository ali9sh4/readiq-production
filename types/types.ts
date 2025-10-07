// types/course.ts
export type FirestoreTimestamp = {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
};
export interface CourseFile {
  id: string;
  filename: string;
  size: number;
  originalName: string;
  uploadedAt: string;
  order?: number;
  type: string;
  relatedVideoId?: string; 
}
export interface Course {
  // Required fields (must exist in database)
  id: string;
  title: string;
  category: string;
  createdAt: string | null;
  updatedAt: string | null;

  // Optional fields (can have defaults)
  CourseFiles?: CourseFile[];
  price?: number;
  duration?: number;
  level?: "beginner" | "intermediate" | "advanced" | "all_levels";
  description?: string;
  language?: "arabic" | "english" | "french" | "spanish";
  rating?: number;
  studentsCount?: number;
  instructor?: string;
  subtitle?: string;
  isApproved?: boolean;
  isRejected?: boolean;
  learningPoints?: string[];
  requirements?: string[];
  images?: string[];
  createdBy?: string;
}

export interface CourseResponse {
  success: boolean;
  courses: Course[];
  hasMore: boolean;
  nextCursor: string | null;
  error?: string;
  totalPages?: number;
}

export interface GetCourseOptions {
  filters?: {
    category?: string;
    level?: "beginner" | "intermediate" | "advanced" | "all_levels";
    language?: "arabic" | "english" | "french" | "spanish";
    isApproved?: boolean;
    isRejected?: boolean;
    userId?: string;
  };
  pagination?: {
    pageSize?: number;
    lastDocId?: string;
  };
}
