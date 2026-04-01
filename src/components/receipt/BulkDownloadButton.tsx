"use client";

import { useState } from "react";
import { useToast } from "@/components/common/ToastProvider";

interface BulkDownloadButtonProps {
  year: number;
  month?: number;
  disabled?: boolean;
}

export default function BulkDownloadButton({
  year,
  month,
  disabled,
}: BulkDownloadButtonProps) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (downloadMonth?: number) => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (downloadMonth) {
        params.set("month", String(downloadMonth));
      }

      const response = await fetch(`/api/receipts/download?${params}`);
      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "ダウンロードに失敗しました");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const label = downloadMonth
        ? `receipts_${year}_${String(downloadMonth).padStart(2, "0")}`
        : `receipts_${year}`;
      a.download = `${label}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("ダウンロードに失敗しました");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex gap-2">
      {month && (
        <button
          onClick={() => handleDownload(month)}
          disabled={disabled || downloading}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-600"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {downloading ? "ダウンロード中..." : "月別ダウンロード"}
        </button>
      )}
      <button
        onClick={() => handleDownload()}
        disabled={disabled || downloading}
        className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {downloading ? "ダウンロード中..." : "年間ダウンロード"}
      </button>
    </div>
  );
}
