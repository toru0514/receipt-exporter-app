"use client";

interface YearMonthSelectorProps {
  viewMode: "year" | "month";
  year: number;
  month: number;
  yearOptions: number[];
  onViewModeChange: (mode: "year" | "month") => void;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

export default function YearMonthSelector({
  viewMode,
  year,
  month,
  yearOptions,
  onViewModeChange,
  onYearChange,
  onMonthChange,
}: YearMonthSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600">
        <button
          onClick={() => onViewModeChange("year")}
          className={`px-3 py-2 text-sm font-medium rounded-l-lg ${
            viewMode === "year"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          年
        </button>
        <button
          onClick={() => onViewModeChange("month")}
          className={`px-3 py-2 text-sm font-medium rounded-r-lg ${
            viewMode === "month"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          月
        </button>
      </div>
      <select
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </select>
      {viewMode === "month" && (
        <select
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
