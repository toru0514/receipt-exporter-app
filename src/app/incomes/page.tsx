"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useToast } from "@/components/common/ToastProvider";
import { fetcher } from "@/lib/swr";

import IncomeTable from "@/components/income/IncomeTable";
import IncomeSummary from "@/components/income/IncomeSummary";
import AddIncomeModal from "@/components/income/AddIncomeModal";
import type { Income, IncomeCreateInput } from "@/lib/income-types";
import YearMonthSelector from "@/components/common/YearMonthSelector";

export default function IncomesPage() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<"year" | "month">("year");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Income | null>(null);

  const incomesParams = new URLSearchParams({ year: String(year) });
  if (viewMode === "month") {
    incomesParams.set("month", String(month));
  }
  const incomesKey = `/api/incomes?${incomesParams}`;

  const { data: incomesData, isLoading, mutate: mutateIncomes } = useSWR(incomesKey, fetcher);
  const { data: clientsData, mutate: mutateClients } = useSWR("/api/incomes/clients", fetcher);

  const incomes: Income[] = incomesData?.incomes ?? [];
  const totalCount: number = incomesData?.totalCount ?? 0;
  const clients: string[] = clientsData?.clients ?? [];

  const handleAdd = async (input: IncomeCreateInput) => {
    const res = await fetch("/api/incomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("登録失敗");
    await mutateIncomes();
    await mutateClients();
  };

  const handleUpdate = async (input: IncomeCreateInput) => {
    if (!editTarget) return;
    const res = await fetch("/api/incomes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editTarget.id, ...input }),
    });
    if (!res.ok) throw new Error("更新失敗");
    await mutateIncomes();
    await mutateClients();
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/incomes?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除失敗");
      await mutateIncomes();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const handleEdit = (income: Income) => {
    setEditTarget(income);
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

  const totalAmount = incomes.reduce((sum, i) => sum + i.amount, 0);
  const yearMonthLabel = viewMode === "year" ? `${year}年` : `${year}年${month}月`;
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            入金管理
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
                const res = await fetch(`/api/incomes/csv?${params}`);
                if (!res.ok) {
                  alert("CSVダウンロードに失敗しました");
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = viewMode === "year"
                  ? `incomes_${year}.csv`
                  : `incomes_${year}_${String(month).padStart(2, "0")}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              disabled={incomes.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              CSVダウンロード
            </button>
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
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
        <IncomeSummary
          totalAmount={totalAmount}
          count={totalCount}
          yearMonth={yearMonthLabel}
        />

        {/* 入金一覧 */}
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
            <IncomeTable incomes={incomes} onDelete={handleDelete} onEdit={handleEdit} />
          )}
        </section>
      </main>

      {/* 追加/編集モーダル */}
      <AddIncomeModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={editTarget ? handleUpdate : handleAdd}
        clients={clients}
        editTarget={editTarget}
      />
    </>
  );
}
