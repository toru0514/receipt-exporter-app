"use client";

import { useState, useEffect } from "react";

interface MediaItem {
  id: string;
  url: string;
}

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchMedia() {
      try {
        const res = await fetch("/api/microcms-media");
        if (!res.ok) throw new Error("取得に失敗しました");
        const data = await res.json();
        setMedia(data.media ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    }
    fetchMedia();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
      <h1 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
        画像管理
      </h1>

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
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && media.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          画像がありません
        </p>
      )}

      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="aspect-square">
                <img
                  src={item.url}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        {media.length}件の画像（microCMS メディア）
      </p>
    </main>
  );
}
