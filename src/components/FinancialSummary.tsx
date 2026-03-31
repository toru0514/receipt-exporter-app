"use client";

import { useState, useEffect, useCallback } from "react";

interface DashboardData {
  year: number;
  month: number;
  income: { total: number; count: number };
  expense: {
    receipt: { total: number; count: number };
    manual: { total: number; count: number };
    total: number;
  };
  balance: number;
}

export default function FinancialSummary() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const yearOptions = Array.from(
    { length: 5 },
    (_, i) => now.getFullYear() - 2 + i
  );

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      const res = await fetch(`/api/dashboard/summary?${params}`);
      if (!res.ok) throw new Error("取得失敗");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("収支サマリー取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const balanceColor =
    data && data.balance > 0
      ? "text-green-600 dark:text-green-400"
      : data && data.balance < 0
        ? "text-red-600 dark:text-red-400"
        : "text-gray-900 dark:text-gray-100";

  const balanceLabel =
    data && data.balance > 0
      ? "黒字"
      : data && data.balance < 0
        ? "赤字"
        : "収支ゼロ";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          収支サマリー
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
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
      ) : data ? (
        <>
          {/* メインバランス */}
          <div className="mb-5 rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {year}年{month}月の収支
            </p>
            <p className={`mt-1 text-3xl font-bold ${balanceColor}`}>
              {data.balance >= 0 ? "+" : ""}¥{data.balance.toLocaleString()}
            </p>
            <span
              className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                data.balance > 0
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : data.balance < 0
                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {balanceLabel}
            </span>
          </div>

          {/* 内訳 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* 入金 */}
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                入金合計
              </p>
              <p className="mt-1 text-xl font-bold text-green-600 dark:text-green-400">
                ¥{data.income.total.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {data.income.count}件
              </p>
            </div>

            {/* 出金合計 */}
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                出金合計
              </p>
              <p className="mt-1 text-xl font-bold text-orange-600 dark:text-orange-400">
                ¥{data.expense.total.toLocaleString()}
              </p>
              <div className="mt-1 space-y-0.5 text-xs text-gray-400 dark:text-gray-500">
                <p>
                  領収書/EC: ¥{data.expense.receipt.total.toLocaleString()} ({data.expense.receipt.count}件)
                </p>
                {data.expense.manual.count > 0 && (
                  <p>
                    出金管理: ¥{data.expense.manual.total.toLocaleString()} ({data.expense.manual.count}件)
                  </p>
                )}
              </div>
            </div>

            {/* 差引 */}
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                差引残高
              </p>
              <p className={`mt-1 text-xl font-bold ${balanceColor}`}>
                {data.balance >= 0 ? "+" : ""}¥{data.balance.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                入金 - 出金
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          データを取得できませんでした
        </p>
      )}
    </section>
  );
}
