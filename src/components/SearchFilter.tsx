"use client";

import { useState, useCallback } from "react";

interface SearchFilterProps {
  onSearch: (keyword: string) => void;
  disabled?: boolean;
}

export default function SearchFilter({
  onSearch,
  disabled = false,
}: SearchFilterProps) {
  const [keyword, setKeyword] = useState("");

  const handleChange = useCallback(
    (value: string) => {
      setKeyword(value);
      onSearch(value);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setKeyword("");
    onSearch("");
  }, [onSearch]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={keyword}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="商品名・金額で検索..."
          disabled={disabled}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 pl-8 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
        />
        <svg
          className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      {keyword && (
        <button
          onClick={handleClear}
          disabled={disabled}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          クリア
        </button>
      )}
    </div>
  );
}
