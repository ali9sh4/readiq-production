// Updated lib/R2/file-security.ts

import crypto from "crypto";
import path from "path";

// ✅ COMPLETE EXTENSION_MIME_MAP with 3D files
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  // Documents
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".txt": ["text/plain"],
  ".csv": ["text/csv"],

  // Videos
  ".mp4": ["video/mp4"],
  ".webm": ["video/webm"],
  ".mov": ["video/quicktime"],
  ".avi": ["video/x-msvideo"],
  ".mkv": ["video/x-matroska"],

  // Audio
  ".mp3": ["audio/mpeg"],
  ".wav": ["audio/wav", "audio/wave", "audio/x-wav"],
  ".m4a": ["audio/x-m4a"],
  ".aac": ["audio/aac"],

  // Images
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
  ".svg": ["image/svg+xml"],

  // Archives
  ".zip": ["application/zip", "application/x-zip-compressed"],
  ".rar": ["application/x-rar-compressed"],
  ".7z": ["application/x-7z-compressed"],
  ".tar": ["application/x-tar"],
  ".gz": ["application/gzip"],

  // ✅ 3D Models - IMPORTANT: application/octet-stream is generic binary
  ".stl": ["model/stl", "application/octet-stream", "application/sla"],
  ".obj": ["model/obj", "application/octet-stream", "text/plain"],
  ".fbx": ["application/octet-stream"],
  ".blend": ["application/octet-stream"],
  ".gltf": ["model/gltf+json", "application/json"],
  ".glb": ["model/gltf-binary", "application/octet-stream"],
  ".ply": ["model/ply", "application/octet-stream", "text/plain"],

  // Code files
  ".js": ["text/javascript", "application/javascript"],
  ".jsx": ["text/javascript", "application/javascript"],
  ".ts": ["text/typescript", "application/typescript"],
  ".tsx": ["text/typescript", "application/typescript"],
  ".py": ["text/x-python", "text/plain"],
  ".css": ["text/css"],
  ".html": ["text/html"],
  ".json": ["application/json"],
  ".xml": ["application/xml", "text/xml"],
};

const ALLOWED_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",

  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",

  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",

  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",

  // Archives
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",

  // 3D Models
  "model/stl",
  "model/ply",
  "model/obj",
  "model/gltf-binary",
  "model/gltf+json",
  "application/octet-stream", // ✅ Generic binary - needed for 3D files
  "application/sla",

  // Code
  "text/javascript",
  "application/javascript",
  "text/typescript",
  "application/typescript",
  "text/x-python",
  "text/css",
  "text/html",
  "application/json",
  "application/xml",
] as const;

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mkv",
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".stl",
  ".obj",
  ".fbx",
  ".blend",
  ".gltf",
  ".glb",
  ".ply",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".css",
  ".html",
  ".json",
  ".xml",
] as const;

// ✅ FIXED: Dynamic file size limits
const MAX_FILE_SIZES: Record<string, number> = {
  default: 50 * 1024 * 1024, // 50 MB
  video: 200 * 1024 * 1024, // 200 MB
  model3d: 100 * 1024 * 1024, // 100 MB
  archive: 150 * 1024 * 1024, // 150 MB
  image: 20 * 1024 * 1024, // 20 MB
};

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
 * ✅ Get max file size based on extension
 */
function getMaxFileSizeByExtension(extension: string): number {
  const ext = extension.toLowerCase();

  // 3D Models
  if (
    [".stl", ".obj", ".fbx", ".blend", ".gltf", ".glb", ".ply"].includes(ext)
  ) {
    return MAX_FILE_SIZES.model3d;
  }

  // Videos
  if ([".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(ext)) {
    return MAX_FILE_SIZES.video;
  }

  // Archives
  if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext)) {
    return MAX_FILE_SIZES.archive;
  }

  // Images
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)) {
    return MAX_FILE_SIZES.image;
  }

  return MAX_FILE_SIZES.default;
}

/**
 * Comprehensive file validation
 */
export function validateFile(file: File): FileValidationResult {
  try {
    // Validate file extension first
    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension as any)) {
      return {
        isValid: false,
        error: `File extension ${extension} is not allowed`,
      };
    }

    // ✅ FIXED: Check size based on file type
    const maxSize = getMaxFileSizeByExtension(extension);
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size exceeds ${
          maxSize / 1024 / 1024
        }MB limit for ${extension} files`,
      };
    }

    if (file.size === 0) {
      return {
        isValid: false,
        error: "File is empty",
      };
    }

    // ✅ FIXED: Validate MIME type OR accept if extension is allowed
    const allowedMimes = EXTENSION_MIME_MAP[extension];

    // If MIME type mapping exists, validate it
    if (allowedMimes && allowedMimes.length > 0) {
      if (!allowedMimes.includes(file.type)) {
        // ✅ For binary files (like STL), browsers might report different MIME types
        // So we're more lenient if the extension is correct
        if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
          return {
            isValid: false,
            error: `File type mismatch: ${extension} files should be ${allowedMimes[0]}, but got ${file.type}`,
          };
        }
      }
    } else {
      // Fallback: just check if MIME type is in allowed list
      if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
        return {
          isValid: false,
          error: `File type ${file.type} is not allowed`,
        };
      }
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
    console.error("File validation error:", error);
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
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]|[._-]$/g, "");

  if (!sanitized) {
    return `file_${Date.now()}`;
  }

  return sanitized;
}

/**
 * Generate secure filename with timestamp and hash
 */
export function generateSecureFilename(
  originalName: string,
  courseId: string
): string {
  const extension = path.extname(originalName);
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString("hex");

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
 */
export async function createFileMetadata(
  file: File,
  buffer: Buffer,
  courseId: string
): Promise<FileMetadata> {
  const hash = await generateFileHash(buffer);
  const sanitizedName = generateSecureFilename(file.name, courseId);

  return {
    originalName: file.name,
    sanitizedName,
    size: file.size,
    mimeType: file.type,
    extension: path.extname(file.name).toLowerCase(),
    hash,
  };
}

export function extractCourseIdFromFilename(filename: string): string | null {
  const match = filename.match(/^courses\/([^\/]+)\//);
  return match ? match[1] : null;
}

export function isNewStructureFilename(filename: string): boolean {
  return filename.startsWith("courses/") && filename.split("/").length === 3;
}

export function isOldStructureFilename(filename: string): boolean {
  return /^\d+/.test(filename) && !filename.includes("/");
}
