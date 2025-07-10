// types/course.ts
export type FirestoreTimestamp = {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
};

export interface  Course {
  rating: number;
  studentsCount: number;
  instructor: string;
  isApproved?: boolean;
  isRejected?: boolean;
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  price: number;
  description: string;
  level: "beginner" | "intermediate" | "advanced" | "all_levels";
  language: "arabic" | "english" | "french" | "spanish";
  duration: number;
  learningPoints?: string[];
  requirements?: string[];
  image?: string;
  createdAt: FirestoreTimestamp | Date | null;
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
