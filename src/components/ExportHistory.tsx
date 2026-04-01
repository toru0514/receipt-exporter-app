"use client";

import { useState } from "react";
import {
  ExportHistoryEntry,
  getExportHistory,
  clearExportHistory,
} from "@/lib/export-history";
import { useConfirm } from "@/components/common/ConfirmDialog";

export default function ExportHistory() {
  const confirmDialog = useConfirm();
  const [history, setHistory] = useState<ExportHistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return getExportHistory();
  });
  const [isOpen, setIsOpen] = useState(false);

  const handleClear = async () => {
    const ok = await confirmDialog({
      title: "履歴の削除",
      message: "エクスポート履歴をすべて削除しますか？",
    });
    if (ok) {
      clearExportHistory();
      setHistory([]);
    }
  };

  if (history.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <span>エクスポート履歴 ({history.length}件)</span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform dark:text-gray-500 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {entry.orderCount}件のデータをエクスポート
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {new Date(entry.exportedAt).toLocaleString("ja-JP")}
                  </p>
                </div>
                <a
                  href={entry.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 shrink-0 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  開く
                </a>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-200 px-4 py-2 dark:border-gray-700">
            <button
              onClick={handleClear}
              className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              履歴をクリア
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
