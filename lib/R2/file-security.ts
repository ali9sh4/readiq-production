// Updated lib/file-security.ts

import crypto from "crypto";
import path from "path";
// Add this constant
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ".mp4": ["video/mp4"],
  ".webm": ["video/webm"],
  ".mp3": ["audio/mpeg"],
  ".wav": ["audio/wav", "audio/wave", "audio/x-wav"],
  ".zip": ["application/zip", "application/x-zip-compressed"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
};
// Allowed file types for course materials
const ALLOWED_MIME_TYPES = [
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
] as const;

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".zip",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

// Security constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILENAME_LENGTH = 255;

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedName?: string;
}

export interface FileMetadata {
  originalName: string;
  sanitizedName: string;
  size: number;
  mimeType: string;
  extension: string;
  hash: string;
}

/**
 * Comprehensive file validation
 */
export function validateFile(file: File): FileValidationResult {
  try {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
      };
    }

    if (file.size === 0) {
      return {
        isValid: false,
        error: "File is empty",
      };
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
      return {
        isValid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }

    // Validate file extension
    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension as any)) {
      return {
        isValid: false,
        error: `File extension ${extension} is not allowed`,
      };
    }
    const allowedMimes = EXTENSION_MIME_MAP[extension];
    if (!allowedMimes || !allowedMimes.includes(file.type)) {
      return {
        isValid: false,
        error: `File type mismatch: ${extension} files must be ${allowedMimes?.[0]}, but got ${file.type}`,
      };
    }

    // Validate filename length
    if (file.name.length > MAX_FILENAME_LENGTH) {
      return {
        isValid: false,
        error: "Filename is too long",
      };
    }

    // Sanitize filename
    const sanitizedName = sanitizeFilename(file.name);

    return {
      isValid: true,
      sanitizedName,
    };
  } catch (error) {
    console.error(error);
    return {
      isValid: false,
      error: "File validation failed",
    };
  }
}

/**
 * Sanitize filename to prevent security issues
 */
export function sanitizeFilename(filename: string): string {
  // Remove dangerous characters
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars with underscore
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .replace(/^[._-]|[._-]$/g, ""); // Remove leading/trailing dots, underscores, hyphens

  // Ensure filename isn't empty
  if (!sanitized) {
    return `file_${Date.now()}`;
  }

  return sanitized;
}

/**
 * Generate secure filename with timestamp and hash
 * ✅ UPDATED: Now includes courseId for folder structure
 */
export function generateSecureFilename(
  originalName: string,
  courseId: string
): string {
  const extension = path.extname(originalName); // Keep original extension
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString("hex");

  // Pure timestamp + hash approach - no filename confusion
  return `courses/${courseId}/${timestamp}_${randomHash}${extension}`;
}

/**
 * Generate file hash for integrity checking
 */
export async function generateFileHash(buffer: Buffer): Promise<string> {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Create file metadata object
 * ✅ UPDATED: Pass courseId to generateSecureFilename
 */
export async function createFileMetadata(
  file: File,
  buffer: Buffer,
  courseId: string
): Promise<FileMetadata> {
  const hash = await generateFileHash(buffer);
  const sanitizedName = generateSecureFilename(file.name, courseId); // ✅ Pass courseId

  return {
    originalName: file.name,
    sanitizedName,
    size: file.size,
    mimeType: file.type,
    extension: path.extname(file.name).toLowerCase(),
    hash,
  };
}

// ✅ NEW: Additional utility functions for folder-based operations

/**
 * Extract courseId from a filename path
 */
export function extractCourseIdFromFilename(filename: string): string | null {
  const match = filename.match(/^courses\/([^\/]+)\//);
  return match ? match[1] : null;
}

/**
 * Check if filename follows new folder structure
 */
export function isNewStructureFilename(filename: string): boolean {
  return filename.startsWith("courses/") && filename.split("/").length === 3;
}

/**
 * Check if filename follows old flat structure
 */
export function isOldStructureFilename(filename: string): boolean {
  return /^\d+/.test(filename) && !filename.includes("/");
}
