"use client";

import { useState } from "react";

function getDefaultDates() {
  const today = new Date();
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return {
    after: oneMonthAgo.toISOString().split("T")[0],
    before: today.toISOString().split("T")[0],
  };
}

interface DateRangeFilterProps {
  onApply: (after: string, before: string) => void;
  disabled?: boolean;
}

export default function DateRangeFilter({
  onApply,
  disabled = false,
}: DateRangeFilterProps) {
  const defaults = getDefaultDates();
  const [after, setAfter] = useState(defaults.after);
  const [before, setBefore] = useState(defaults.before);

  const handleClear = () => {
    setAfter("");
    setBefore("");
    onApply("", "");
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
      <div>
        <label
          htmlFor="date-after"
          className="block text-xs font-medium text-gray-600 dark:text-gray-400"
        >
          開始日
        </label>
        <input
          id="date-after"
          type="date"
          value={after}
          onChange={(e) => {
            setAfter(e.target.value);
            onApply(e.target.value, before);
          }}
          disabled={disabled}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 sm:w-auto dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>
      <div>
        <label
          htmlFor="date-before"
          className="block text-xs font-medium text-gray-600 dark:text-gray-400"
        >
          終了日
        </label>
        <input
          id="date-before"
          type="date"
          value={before}
          onChange={(e) => {
            setBefore(e.target.value);
            onApply(after, e.target.value);
          }}
          disabled={disabled}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 sm:w-auto dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>
      {(after || before) && (
        <button
          onClick={handleClear}
          disabled={disabled}
          className="self-end rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          クリア
        </button>
      )}
    </div>
  );
}
