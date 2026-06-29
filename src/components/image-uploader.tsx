'use client'

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export interface UploadedImage {
  dataUrl: string;
  name: string;
  size: number;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  label?: string;
  disabled?: boolean;
}

export function ImageUploader({
  images,
  onChange,
  maxImages = 6,
  label = "Screenshots",
  disabled = false,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (fileArray.length === 0) {
        toast.error("Please select image files only");
        return;
      }
      const remaining = maxImages - images.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${maxImages} images reached`);
        return;
      }
      const toProcess = fileArray.slice(0, remaining);
      if (fileArray.length > remaining) {
        toast.info(`Only added ${remaining} of ${fileArray.length} images (max ${maxImages})`);
      }
      const newImages: UploadedImage[] = [];
      for (const file of toProcess) {
        const dataUrl = await compressImage(file, 1280, 0.85);
        newImages.push({ dataUrl, name: file.name, size: file.size });
      }
      onChange([...images, ...newImages]);
    },
    [images, maxImages, onChange],
  );

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  }, [processFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles, disabled]);

  const removeImage = useCallback((index: number) => {
    onChange(images.filter((_, i) => i !== index));
  }, [images, onChange]);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label} ({images.length}/{maxImages})</Label>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        className={`border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer ${
          isDragging ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-muted-foreground/30 hover:border-muted-foreground/50"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" disabled={disabled} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Drag & drop screenshots here, or click to select</p>
        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — up to {maxImages} images</p>
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group aspect-square rounded-md overflow-hidden border">
              <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">{img.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function compressImage(file: File, maxDimension: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Could not get canvas context")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const isScreenshot = file.type === "image/png";
        const mimeType = isScreenshot ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(mimeType, quality));
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
