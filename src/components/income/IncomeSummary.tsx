"use client";

interface IncomeSummaryProps {
  totalAmount: number;
  count: number;
  yearMonth: string;
}

export default function IncomeSummary({
  totalAmount,
  count,
  yearMonth,
}: IncomeSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          対象期間
        </p>
        <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
          {yearMonth}
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          合計入金額
        </p>
        <p className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">
          ¥{totalAmount.toLocaleString()}
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          入金件数
        </p>
        <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
          {count}件
        </p>
      </div>
    </div>
  );
}
