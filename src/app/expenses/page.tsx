"use client";

import { useState } from "react";
import useSWR from "swr";
import { useToast } from "@/components/common/ToastProvider";
import { fetcher } from "@/lib/swr";

import ExpenseTable from "@/components/expense/ExpenseTable";
import ExpenseSummary from "@/components/expense/ExpenseSummary";
import AddExpenseModal from "@/components/expense/AddExpenseModal";
import type { Expense, ExpenseCreateInput } from "@/lib/expense-types";
import YearMonthSelector from "@/components/common/YearMonthSelector";

export default function ExpensesPage() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<"year" | "month">("year");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);

  const expensesParams = new URLSearchParams({ year: String(year) });
  if (viewMode === "month") {
    expensesParams.set("month", String(month));
  }
  const expensesKey = `/api/expenses?${expensesParams}`;

  const { data: expensesData, isLoading, mutate: mutateExpenses } = useSWR(expensesKey, fetcher);
  const { data: payeesData, mutate: mutatePayees } = useSWR("/api/expenses/payees", fetcher);

  const expenses: Expense[] = expensesData?.expenses ?? [];
  const totalCount: number = expensesData?.totalCount ?? 0;
  const payees: string[] = payeesData?.payees ?? [];

  const handleAdd = async (input: ExpenseCreateInput) => {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("登録失敗");
    await mutateExpenses();
    await mutatePayees();
  };

  const handleUpdate = async (input: ExpenseCreateInput) => {
    if (!editTarget) return;
    const res = await fetch("/api/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editTarget.id, ...input }),
    });
    if (!res.ok) throw new Error("更新失敗");
    await mutateExpenses();
    await mutatePayees();
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除失敗");
      await mutateExpenses();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditTarget(expense);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditTarget(null);
  };

  const handleOpenAddModal = () => {
    setEditTarget(null);
    setShowModal(true);
  };

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const yearMonthLabel = viewMode === "year" ? `${year}年` : `${year}年${month}月`;
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            出金管理
          </h2>
        </div>

        {/* 年月セレクター + 追加ボタン */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <YearMonthSelector
            viewMode={viewMode}
            year={year}
            month={month}
            yearOptions={yearOptions}
            onViewModeChange={setViewMode}
            onYearChange={setYear}
            onMonthChange={setMonth}
          />

          <div className="flex gap-2">
            <button
              onClick={async () => {
                const params = new URLSearchParams({ year: String(year) });
                if (viewMode === "month") {
                  params.set("month", String(month));
                }
                const res = await fetch(`/api/expenses/csv?${params}`);
                if (!res.ok) {
                  alert("CSVダウンロードに失敗しました");
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = viewMode === "year"
                  ? `expenses_${year}.csv`
                  : `expenses_${year}_${String(month).padStart(2, "0")}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              disabled={expenses.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              CSVダウンロード
            </button>
            <button
              onClick={handleOpenAddModal}
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
          </div>
        </section>

        {/* 集計 */}
        <ExpenseSummary
          totalAmount={totalAmount}
          count={totalCount}
          yearMonth={yearMonthLabel}
        />

        {/* 出金一覧 */}
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {isLoading ? (
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
            <ExpenseTable expenses={expenses} onDelete={handleDelete} onEdit={handleEdit} />
          )}
        </section>
      </main>

      {/* 追加/編集モーダル */}
      <AddExpenseModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={editTarget ? handleUpdate : handleAdd}
        payees={payees}
        editTarget={editTarget}
      />
    </>
  );
}
