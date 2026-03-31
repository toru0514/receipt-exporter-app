"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import ExpenseTable from "@/components/expense/ExpenseTable";
import ExpenseSummary from "@/components/expense/ExpenseSummary";
import AddExpenseModal from "@/components/expense/AddExpenseModal";
import type { Expense, ExpenseCreateInput } from "@/lib/expense-types";

export default function ExpensesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [payees, setPayees] = useState<string[]>([]);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      const res = await fetch(`/api/expenses?${params}`);
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setExpenses(data.expenses);
      setTotalCount(data.totalCount);
    } catch (err) {
      console.error("出金取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const fetchPayees = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses/payees");
      if (!res.ok) return;
      const data = await res.json();
      setPayees(data.payees);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    fetchPayees();
  }, [fetchPayees]);

  const handleAdd = async (input: ExpenseCreateInput) => {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("登録失敗");
    await fetchExpenses();
    await fetchPayees();
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除失敗");
      await fetchExpenses();
    } catch {
      alert("削除に失敗しました");
    }
  };

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const yearMonthLabel = `${year}年${month}月`;
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            出金管理
          </h2>
        </div>

        {/* 年月セレクター + 追加ボタン */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            追加
          </button>
        </section>

        {/* 集計 */}
        <ExpenseSummary
          totalAmount={totalAmount}
          count={totalCount}
          yearMonth={yearMonthLabel}
        />

        {/* 出金一覧 */}
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {loading ? (
            <div className="flex items-center justify-center py-12">
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
          ) : (
            <ExpenseTable expenses={expenses} onDelete={handleDelete} />
          )}
        </section>
      </main>

      {/* 追加モーダル */}
      <AddExpenseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAdd}
        payees={payees}
      />
    </div>
  );
}
