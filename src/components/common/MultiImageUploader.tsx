"use client";

import { useRef, useState, useCallback } from "react";
import { uploadToMicroCMS } from "./ImageUploader";

interface MultiImageUploaderProps {
  values: string[];
  onChange: (urls: string[]) => void;
}

export default function MultiImageUploader({
  values,
  onChange,
}: MultiImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const validFiles = files.filter((file) => {
        if (!file.type.startsWith("image/")) {
          setError("画像ファイルを選択してください");
          return false;
        }
        if (file.size > 10 * 1024 * 1024) {
          setError("ファイルサイズは10MB以下にしてください");
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      setError("");
      setUploading(true);

      try {
        const newUrls: string[] = [];
        for (const file of validFiles) {
          const url = await uploadToMicroCMS(file);
          newUrls.push(url);
        }
        onChange([...values, ...newUrls]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "アップロードに失敗しました"
        );
      } finally {
        setUploading(false);
      }
    },
    [onChange, values]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        uploadFiles(Array.from(files));
      }
      e.target.value = "";
    },
    [uploadFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        uploadFiles(Array.from(files));
      }
    },
    [uploadFiles]
  );

  const removeImage = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {/* Uploaded images grid */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((url, index) => (
            <div key={index} className="relative h-16 w-16">
              <img
                src={url}
                alt={`写真${index + 1}`}
                className="h-full w-full rounded-lg border border-gray-200 object-cover dark:border-gray-600"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white shadow hover:bg-red-600"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex h-20 items-center justify-center rounded-lg border-2 border-dashed text-sm transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400"
            : "border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"
        }`}
      >
        {uploading ? (
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            アップロード中...
          </div>
        ) : (
          "ここにドラッグ&ドロップ（複数可）"
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          撮影
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          ファイル選択
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
