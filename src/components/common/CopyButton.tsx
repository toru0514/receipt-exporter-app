"use client";

import { useState, useCallback } from "react";

interface CopyButtonProps {
  value: string;
  className?: string;
}

export default function CopyButton({ value, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
    }
  }, [value]);

  if (!value || value === "-") return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`ml-1 inline-flex shrink-0 items-center text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 ${className}`}
      title="コピー"
    >
      {copied ? (
        <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
