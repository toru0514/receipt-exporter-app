"use client";

import { useState, useEffect, useCallback } from "react";

interface MediaItem {
  url: string;
  fileName: string;
  width?: number;
  height?: number;
  createdAt: string;
}

interface MicroCMSMediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
}

export default function MicroCMSMediaPicker({
  open,
  onClose,
  onSelect,
}: MicroCMSMediaPickerProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchMedia = useCallback(async (newOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/microcms/media?offset=${newOffset}&limit=${limit}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "取得に失敗しました");
      }
      const data = await res.json();
      setMedia(data.media || []);
      setTotalCount(data.totalCount || 0);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchMedia(0);
    }
  }, [open, fetchMedia]);

  if (!open) return null;

  const hasNext = offset + limit < totalCount;
  const hasPrev = offset > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            microCMSメディアから選択
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <svg
              className="h-5 w-5"
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

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg
                className="h-6 w-6 animate-spin text-gray-400"
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
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && media.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              メディアが見つかりません
            </div>
          )}

          {!loading && !error && media.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {media.map((item) => (
                <button
                  key={item.url}
                  onClick={() => onSelect(item.url)}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 hover:border-blue-500 hover:ring-2 hover:ring-blue-500 dark:border-gray-600 dark:hover:border-blue-400 dark:hover:ring-blue-400"
                >
                  <img
                    src={item.url + "?w=200&h=200&fit=crop"}
                    alt={item.fileName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-xs text-white">
                      {item.fileName}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ページネーション */}
        {totalCount > limit && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {offset + 1}〜{Math.min(offset + limit, totalCount)} / {totalCount}件
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchMedia(offset - limit)}
                disabled={!hasPrev}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                前へ
              </button>
              <button
                onClick={() => fetchMedia(offset + limit)}
                disabled={!hasNext}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
