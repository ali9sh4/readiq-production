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
export type ImageUpload = {
  id: string;
  url: string;
  file?: File;
  isExisting?: boolean; // Indicates if this image is already stored in the database
};

type Props = {
  image?: ImageUpload;
  onImageChange: (images: ImageUpload | undefined) => void;
  urlFormatter?: (image: ImageUpload) => string;
  onDelete?: () => Promise<void>;
  isDeleting?: boolean;
};

export default function ThumbNailUploader({
  image,
  onImageChange,
  urlFormatter,
  onDelete,
  isDeleting = false,
}: Props) {
  const images = image ? [image] : [];
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const handleImagesChange = (updatedImages: ImageUpload[]) => {
    const singleImage = updatedImages.length > 0 ? updatedImages[0] : undefined;
    onImageChange(singleImage);
  };

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

    handleImagesChange(newImages);
  };

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const file = files[0]; // Only take first file

      validateFile(file);

      const url = createSafeObjectURL(file);
      if (!url) {
        throw new Error(`Failed to process file "${file.name}"`);
      }

      const newImage: ImageUpload = {
        id: `${Date.now()}-${file.name}`,
        url,
        file,
      };

      handleImagesChange([newImage]); // Replace, don't append
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const removeImageLocally = (imageId: string) => {
    const imageToRemove = images.find((img) => img.id === imageId);
    if (imageToRemove?.url.startsWith("blob:")) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    handleImagesChange(images.filter((img) => img.id !== imageId));
    setError(null); // Clear any previous errors
  };
  const handleDeleteImage = async (image: ImageUpload) => {
    if (image.isExisting && onDelete) {
      await onDelete();
      removeImageLocally(image.id); // ✅ Call parent's delete function for existing images
    } else {
      removeImageLocally(image.id); // Just remove locally for new images
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
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        ref={uploadInputRef}
        onChange={handleInputChange}
        disabled={isProcessing}
      />

      <Button
        className="w-full mb-4 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        type="button"
        disabled={isProcessing || images.length >= 1}
        onClick={() => {
          uploadInputRef?.current?.click();
        }}
      >
        <Upload className="w-5 h-5 ml-2" />
        {isProcessing
          ? "جاري المعالجة..."
          : `اختر صورة للتحميل (${images.length}/1)`}{" "}
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
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <X className="w-8 h-8" />
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
