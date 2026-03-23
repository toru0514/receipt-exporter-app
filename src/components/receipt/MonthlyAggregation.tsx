"use client";

interface MonthlyAggregationProps {
  totalAmount: number;
  totalTax: number;
  count: number;
  yearMonth: string; // "YYYY年MM月" 等の表示用
}

export default function MonthlyAggregation({
  totalAmount,
  totalTax,
  count,
  yearMonth,
}: MonthlyAggregationProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
          合計金額
        </p>
        <p className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-400">
          ¥{totalAmount.toLocaleString()}
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          税額合計
        </p>
        <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
          ¥{totalTax.toLocaleString()}
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          領収書枚数
        </p>
        <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
          {count}件
        </p>
      </div>
    </div>
  );
}
