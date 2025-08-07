// app/actions/upload-actions.ts
'use server';

import { PutObjectCommand } from '@aws-sdk/client-s3';

import { 
  validateFile, 
  createFileMetadata, 
  FileMetadata 
} from '@/lib/R2/file-security';
import { R2_BUCKET_NAME, r2Client } from '@/lib/R2/r2_client';

export interface UploadResult {
  success: boolean;
  error?: string;
  data?: {
    filename: string;
    url: string;
    size: number;
    metadata: FileMetadata;
  };
}

/**
 * Secure file upload server action
 */
export async function uploadCourseFile(formData: FormData): Promise<UploadResult> {
  try {
    // Extract file from form data
    const file = formData.get('file') as File;
    
    if (!file) {
      return {
        success: false,
        error: 'No file provided'
      };
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create file metadata
    const metadata = await createFileMetadata(file, buffer);

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: metadata.sanitizedName,
      Body: buffer,
      ContentType: file.type,
      ContentLength: file.size,
      Metadata: {
        originalName: metadata.originalName,
        uploadedAt: new Date().toISOString(),
        fileHash: metadata.hash,
        uploader: 'course-system', // You can add user info here
      },
      // Security headers
      ServerSideEncryption: 'AES256',
    });

    await r2Client.send(uploadCommand);

    // Generate public URL (if bucket is public) or signed URL
    const fileUrl = `${process.env.R2_ENDPOINT}/${R2_BUCKET_NAME}/${metadata.sanitizedName}`;

    // Log successful upload (for audit trail)
    console.log(`File uploaded successfully: ${metadata.sanitizedName}`, {
      originalName: file.name,
      size: file.size,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      data: {
        filename: metadata.sanitizedName,
        url: fileUrl,
        size: file.size,
        metadata
      }
    };

  } catch (error) {
    console.error('Upload failed:', error);
    
    // Don't expose internal errors to client
    return {
      success: false,
      error: 'Upload failed. Please try again.'
    };
  }
}

/**
 * Delete course file server action
 */
export async function deleteCourseFile(filename: string): Promise<UploadResult> {
  try {
    // Validate filename to prevent path traversal
    if (!filename || filename.includes('..') || !filename.startsWith('courses/')) {
      return {
        success: false,
        error: 'Invalid filename'
      };
    }

    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    
    const deleteCommand = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
    });

    await r2Client.send(deleteCommand);

    console.log(`File deleted successfully: ${filename}`);

    return {
      success: true,
    };

  } catch (error) {
    console.error('Delete failed:', error);
    
    return {
      success: false,
      error: 'Delete failed. Please try again.'
    };
  }
}