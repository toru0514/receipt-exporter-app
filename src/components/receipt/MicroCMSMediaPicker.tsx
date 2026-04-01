"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/common/ToastProvider";

interface MediaItem {
  url: string;
  id: string;
}

interface MicroCMSMediaPickerProps {
  onSelect: (imageUrl: string, originalUrl?: string) => void;
  onClose: () => void;
  multiple?: boolean;
  /** trueの場合、DataURL変換せず元のURLをそのまま返す */
  rawUrl?: boolean;
}

export default function MicroCMSMediaPicker({
  onSelect,
  onClose,
  multiple,
  rawUrl,
}: MicroCMSMediaPickerProps) {
  const toast = useToast();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    async function fetchMedia() {
      try {
        const res = await fetch("/api/microcms-media");
        if (!res.ok) throw new Error("取得失敗");
        const data = await res.json();
        setMedia(data.media);
      } catch {
        setError("メディアの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchMedia();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    const selected = media.filter((item) => selectedIds.has(item.id));
    if (selected.length === 0) return;

    if (rawUrl) {
      for (const item of selected) {
        onSelect(item.url);
      }
      onClose();
      return;
    }

    setConverting(true);
    for (const item of selected) {
      try {
        const res = await fetch(item.url);
        const blob = await res.blob();
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onload = () => {
            onSelect(reader.result as string, item.url);
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      } catch {
        // skip failed items
      }
    }
    setConverting(false);
    onClose();
  };

  const handleSingleSelect = async (url: string) => {
    if (rawUrl) {
      onSelect(url);
      onClose();
      return;
    }


    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        onSelect(reader.result as string, url);
      };
      reader.readAsDataURL(blob);
    } catch {
      toast.error("画像の読み込みに失敗しました");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            microCMSメディアから選択
            {multiple && selectedIds.size > 0 && (
              <span className="ml-2 text-sm font-normal text-blue-600 dark:text-blue-400">
                {selectedIds.size}件選択中
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {multiple && selectedIds.size > 0 && (
              <button
                onClick={handleConfirm}
                disabled={converting}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {converting ? "読み込み中..." : `${selectedIds.size}件を追加`}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
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
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(80vh - 64px)" }}>
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
            <p className="py-8 text-center text-sm text-red-500">{error}</p>
          )}

          {!loading && !error && media.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              メディアが見つかりません
            </p>
          )}

          {!loading && !error && media.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {media.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    multiple
                      ? toggleSelect(item.id)
                      : handleSingleSelect(item.url)
                  }
                  className={`group relative aspect-square overflow-hidden rounded-lg border-2 focus:outline-none ${
                    selectedIds.has(item.id)
                      ? "border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700"
                      : "border-transparent hover:border-blue-500"
                  }`}
                >
                  <img
                    src={item.url}
                    alt="メディア画像"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  {multiple && selectedIds.has(item.id) && (
                    <div className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      ✓
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
