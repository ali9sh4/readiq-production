import { db } from "@/firebase/service";

interface MonitorEvent {
  type:
    | "upload_success"
    | "upload_failed"
    | "error"
    | "file_access"
    | "course_approval"
    | "system_info";
  message: string;
  userId?: string;
  courseId?: string;
  fileName?: string;
  severity?: "low" | "medium" | "high";
  metadata?: Record<string, any>;
  timestamp: FirebaseFirestore.Timestamp;
}

class FirebaseMonitor {
  private async logEvent(
    event: Omit<MonitorEvent, "timestamp">
  ): Promise<void> {
    try {
      await db.collection("system_events").add({
        ...event,
        timestamp: new Date(),
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to log event to Firebase:", error);
      // Don't throw - monitoring shouldn't break the app
    }
  }

  async logUploadSuccess(params: {
    userId: string;
    courseId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  }): Promise<void> {
    await this.logEvent({
      type: "upload_success",
      message: `File uploaded successfully: ${params.fileName}`,
      userId: params.userId,
      courseId: params.courseId,
      fileName: params.fileName,
      severity: "low",
      metadata: {
        fileSize: params.fileSize,
        fileType: params.fileType,
        action: "upload",
      },
    });
  }

  async logUploadFailed(params: {
    userId: string;
    courseId: string;
    fileName: string;
    errorMessage: string;
  }): Promise<void> {
    await this.logEvent({
      type: "upload_failed",
      message: `Upload failed: ${params.errorMessage}`,
      userId: params.userId,
      courseId: params.courseId,
      fileName: params.fileName,
      severity: "medium",
      metadata: {
        errorMessage: params.errorMessage,
        action: "upload",
      },
    });
  }

  async logError(params: {
    userId?: string;
    courseId?: string;
    errorMessage: string;
    severity?: "low" | "medium" | "high";
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logEvent({
      type: "error",
      message: params.errorMessage,
      userId: params.userId,
      courseId: params.courseId,
      severity: params.severity || "medium",
      metadata: params.metadata,
    });
  }

  async logFileAccess(params: {
    userId: string;
    courseId: string;
    fileName: string;
    action: "view" | "download";
  }): Promise<void> {
    await this.logEvent({
      type: "file_access",
      message: `File ${params.action}: ${params.fileName}`,
      userId: params.userId,
      courseId: params.courseId,
      fileName: params.fileName,
      severity: "low",
      metadata: {
        action: params.action,
      },
    });
  }

  async logCourseApproval(params: {
    adminUserId: string;
    courseId: string;
    courseName: string;
    approved: boolean;
    courseCreatorId?: string;
  }): Promise<void> {
    await this.logEvent({
      type: "course_approval",
      message: `Course ${params.approved ? "approved" : "rejected"}: ${
        params.courseName
      }`,
      userId: params.adminUserId,
      courseId: params.courseId,
      severity: "low",
      metadata: {
        approved: params.approved,
        courseName: params.courseName,
        courseCreatorId: params.courseCreatorId,
        action: params.approved ? "approve" : "reject",
      },
    });
  }

  async logSystemInfo(params: {
    message: string;
    userId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logEvent({
      type: "system_info",
      message: params.message,
      userId: params.userId,
      severity: "low",
      metadata: params.metadata,
    });
  }
}

export const firebaseMonitor = new FirebaseMonitor();
export default firebaseMonitor;
