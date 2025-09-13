// firebase-monitor.ts - Fixed for Next.js client-side usage
import { db } from "@/firebase/client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Make sure to use the client SDK, not admin SDK

interface BaseMonitorEvent {
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
  severity: "low" | "medium" | "high";
  timestamp: any; // Firebase serverTimestamp
  createdAt: string;
}

interface MonitorEvent extends BaseMonitorEvent {
  fileName?: string;
  metadata?: Record<string, any>;
}

class FirebaseMonitor {
  private queue: MonitorEvent[] = [];
  private isProcessing = false;

  private async logEvent(
    event: Omit<MonitorEvent, "timestamp" | "createdAt">
  ): Promise<void> {
    try {
      const monitorEvent: MonitorEvent = {
        ...event,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      };

      // Add to queue for batch processing
      this.queue.push(monitorEvent);

      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    } catch (error) {
      console.error("Failed to queue monitoring event:", error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || !db) return;

    this.isProcessing = true;
    const batch = this.queue.splice(0, 10); // Process max 10 events at once

    try {
      // Use individual addDoc calls (simpler than batch for client SDK)
      const promises = batch.map((event) =>
        addDoc(collection(db, "failed_system_events"), event)
      );

      await Promise.allSettled(promises); // Don't fail if one event fails
    } catch (error) {
      console.error("Failed to process monitoring queue:", error);
    } finally {
      this.isProcessing = false;

      // Process remaining queue items
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 1000); // Delay to avoid spam
      }
    }
  }

  // Essential failure logging
  async logUploadFailed(params: {
    userId: string;
    courseId: string;
    fileName: string;
    errorMessage: string;
  }): Promise<void> {
    await this.logEvent({
      type: "upload_failed",
      message: `Upload failed: ${params.fileName}`,
      userId: params.userId,
      courseId: params.courseId,
      fileName: params.fileName,
      severity: "medium",
      metadata: {
        error: params.errorMessage,
        action: "upload",
      },
    });
  }

  // Critical errors only
  async logCriticalError(params: {
    userId?: string;
    courseId?: string;
    errorMessage: string;
    context?: string;
  }): Promise<void> {
    await this.logEvent({
      type: "error",
      message: params.errorMessage,
      userId: params.userId,
      courseId: params.courseId,
      severity: "high",
      metadata: {
        context: params.context,
      },
    });
  }

  // File access logging
  async logFileAccess(params: {
    userId: string;
    courseId: string;
    fileName: string;
    action: "view" | "download";
  }): Promise<void> {
    // Only log downloads to reduce noise
    if (params.action === "download") {
      await this.logEvent({
        type: "file_access",
        message: `File downloaded: ${params.fileName}`,
        userId: params.userId,
        courseId: params.courseId,
        fileName: params.fileName,
        severity: "low",
        metadata: {
          action: params.action,
        },
      });
    }
  }

  // System info - only for important events

  // Force process queue (call on app close/unmount)
  async flush(): Promise<void> {
    await this.processQueue();
  }
}

export const firebaseMonitor = new FirebaseMonitor();
export default firebaseMonitor;
