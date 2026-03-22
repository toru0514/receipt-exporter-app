"use client";

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ current, total, label }: ProgressBarProps) {
  if (total <= 0) return null;

  const percentage = Math.min(Math.round((current / total) * 100), 100);

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-gray-700 dark:text-gray-300">{label}</span>
          <span className="tabular-nums text-gray-500 dark:text-gray-400">
            {current}/{total} ({percentage}%)
          </span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out dark:bg-blue-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
