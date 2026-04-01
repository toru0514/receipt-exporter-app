"use client";

import { useState, useEffect, useCallback } from "react";

interface TimelineRow {
  month: number;
  income: number;
  incomeCount: number;
  expense: number;
  expenseCount: number;
  balance: number;
}

interface Props {
  year: number;
}

export default function TimelineTable({ year }: Props) {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/timeline?year=${year}`);
      if (!res.ok) throw new Error("取得失敗");
      const json = await res.json();
      setRows(json.timeline);
    } catch (err) {
      console.error("タイムライン取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
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
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      expense: acc.expense + r.expense,
      balance: acc.balance + r.balance,
    }),
    { income: 0, expense: 0, balance: 0 }
  );

  return (
    <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {year}年 月別収支
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-b border-gray-200 bg-gray-50 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              <th className="px-4 py-2.5 text-left font-medium">月</th>
              <th className="px-4 py-2.5 text-right font-medium">入金</th>
              <th className="px-4 py-2.5 text-right font-medium">出金</th>
              <th className="px-4 py-2.5 text-right font-medium">収支</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hasData =
                row.income > 0 || row.expense > 0;
              return (
                <tr
                  key={row.month}
                  className={`border-b border-gray-100 dark:border-gray-800 ${
                    !hasData ? "text-gray-300 dark:text-gray-600" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                    {row.month}月
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={hasData ? "text-green-600 dark:text-green-400" : ""}>
                      ¥{row.income.toLocaleString()}
                    </span>
                    {row.incomeCount > 0 && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({row.incomeCount}件)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={hasData ? "text-orange-600 dark:text-orange-400" : ""}>
                      ¥{row.expense.toLocaleString()}
                    </span>
                    {row.expenseCount > 0 && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({row.expenseCount}件)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    <span
                      className={
                        row.balance > 0
                          ? "text-green-600 dark:text-green-400"
                          : row.balance < 0
                            ? "text-red-600 dark:text-red-400"
                            : hasData
                              ? "text-gray-900 dark:text-gray-100"
                              : ""
                      }
                    >
                      {row.balance >= 0 ? "+" : ""}¥{row.balance.toLocaleString()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300 bg-gray-50 font-semibold dark:border-gray-600 dark:bg-gray-900">
              <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                合計
              </td>
              <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400">
                ¥{totals.income.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right text-orange-600 dark:text-orange-400">
                ¥{totals.expense.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right">
                <span
                  className={
                    totals.balance > 0
                      ? "text-green-600 dark:text-green-400"
                      : totals.balance < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-900 dark:text-gray-100"
                  }
                >
                  {totals.balance >= 0 ? "+" : ""}¥{totals.balance.toLocaleString()}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
