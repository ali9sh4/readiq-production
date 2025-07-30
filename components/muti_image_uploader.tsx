"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import Image from "next/image";
import { Badge } from "./ui/badge";
import { Upload, X, GripVertical, File } from "lucide-react";
import { toast } from "sonner";
export type ImageUpload = {
  id: string;
  url: string;
  file?: File;
  path?: string;
  isExisting?: boolean; // Indicates if this image is already stored in the database
};

type Props = {
  images?: ImageUpload[];
  onImagesChange: (images: ImageUpload[]) => void;
  maxImages?: number;
  urlFormatter?: (image: ImageUpload) => string;
};

export default function MultiImageUploader({
  images = [],
  onImagesChange,
  maxImages = 1,
  urlFormatter,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const validateFile = (file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (file.size > maxSize) {
      throw new Error(
        `File "${file.name}" is too large. Maximum size is 10MB.`
      );
    }
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        `File "${file.name}" has invalid type. Only JPEG, PNG, and WebP are allowed.`
      );
    }
  };

  // Cleanup URLs when images change or component unmounts
  const previousImages = useRef<ImageUpload[]>([]);
  useEffect(() => {
    const oldImages = previousImages.current;
    const currentImages = images;

    // Find removed images and cleanup their URLs
    const removedImages = oldImages.filter(
      (oldImg) => !currentImages.find((newImg) => newImg.id === oldImg.id)
    );

    removedImages.forEach((image) => {
      if (image.url.startsWith("blob:")) {
        URL.revokeObjectURL(image.url);
      }
    });

    previousImages.current = images;

    // Cleanup all on unmount
    return () => {
      images.forEach((image) => {
        if (image.url.startsWith("blob:")) {
          URL.revokeObjectURL(image.url);
        }
      });
    };
  }, [images]);

  const createSafeObjectURL = (file: File): string | null => {
    try {
      return URL.createObjectURL(file);
    } catch (error) {
      console.error("Error creating object URL:", error);
      return null;
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newImages = Array.from(images);
    const [reorderedItem] = newImages.splice(result.source.index, 1);
    newImages.splice(result.destination.index, 0, reorderedItem);

    onImagesChange(newImages);
  };

  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Check total count limit
      if (images.length + files.length > maxImages) {
        throw new Error(
          `Cannot upload more than ${maxImages} images. Currently have ${images.length}.`
        );
      }

      const validatedFiles: ImageUpload[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
          validateFile(file); // Actually validate each file!

          const url = createSafeObjectURL(file);
          if (!url) {
            throw new Error(`Failed to process file "${file.name}"`);
          }

          validatedFiles.push({
            id: `${Date.now()}-${i}-${file.name}`,
            url,
            file,
          });
        } catch (fileError) {
          // Continue processing other files, but collect errors
          console.error(`Skipping file ${file.name}:`, fileError);
          if (validatedFiles.length === 0) {
            // If this is the only file or first file, show error
            throw fileError;
          }
        }
      }

      if (validatedFiles.length > 0) {
        onImagesChange([...images, ...validatedFiles]);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsProcessing(false);
      e.target.value = ""; // Reset input
    }
  };

  const removeImageLocally = (imageId: string) => {
    const imageToRemove = images.find((img) => img.id === imageId);
    if (imageToRemove?.url.startsWith("blob:")) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    onImagesChange(images.filter((img) => img.id !== imageId));
    setError(null); // Clear any previous errors
  };
  const handleDeleteImage = async (image: ImageUpload) => {
    setDeletingId(image.id);

    try {
      removeImageLocally(image.id);
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("حدث خطأ أثناء حذف الصورة");
    } finally {
      setDeletingId(null);
    }
  };

  const getBadgeText = (index: number) => {
    if (index === 0) return "الصورة الرئيسية";
    if (index === 1) return "صورة ثانوية";
    return `صورة ${index + 1}`;
  };

  const getBadgeVariant = (index: number) => {
    if (index === 0) return "default";
    if (index === 1) return "secondary";
    return "outline";
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4" dir="rtl">
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        ref={uploadInputRef}
        onChange={handleInputChange}
        disabled={isProcessing}
      />

      <Button
        className="w-full mb-4 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        type="button"
        disabled={isProcessing || images.length >= maxImages}
        onClick={() => {
          uploadInputRef?.current?.click();
        }}
      >
        <Upload className="w-5 h-5 ml-2" />
        {isProcessing
          ? "جاري المعالجة..."
          : `اختر الصور للتحميل (${images.length}/${maxImages})`}
      </Button>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="propertyImage" direction="vertical">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {images.map((image, index) => (
                <Draggable key={image.id} draggableId={image.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`relative p-3 transition-all duration-200 ${
                        snapshot.isDragging ? "opacity-70 scale-105" : ""
                      }`}
                    >
                      <div className="bg-white rounded-lg flex gap-3 items-center p-4 border-2 border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-200">
                        <div
                          {...provided.dragHandleProps}
                          className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="w-16 h-16 relative rounded-lg overflow-hidden border-2 border-gray-200">
                          <Image
                            src={urlFormatter ? urlFormatter(image) : image.url}
                            fill
                            alt=""
                            className="object-cover"
                          />
                        </div>

                        <div className="flex-grow">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-800">
                              صورة {index + 1}
                            </p>
                            <Badge
                              variant={getBadgeVariant(index)}
                              className="text-xs"
                            >
                              {getBadgeText(index)}
                            </Badge>
                          </div>
                          {image.file && (
                            <p className="text-xs text-gray-500 truncate">
                              {image.file.name}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteImage(image)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors disabled:opacity-50"
                          type="button"
                          disabled={deletingId === image.id}
                        >
                          {deletingId === image.id ? (
                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {images.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <File className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>لم يتم اختيار أي صورة بعد</p>
          <p className="text-sm">اضغط على زر اختر الصور لبدء التحميل</p>{" "}
          {/* ✅ Fixed typo */}
        </div>
      )}
    </div>
  );
}
