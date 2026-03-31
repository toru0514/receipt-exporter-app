"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import ReceiptCapture from "@/components/receipt/ReceiptCapture";
import ReceiptTable from "@/components/receipt/ReceiptTable";
import MonthlyAggregation from "@/components/receipt/MonthlyAggregation";
import ReceiptDetail from "@/components/receipt/ReceiptDetail";
import BulkDownloadButton from "@/components/receipt/BulkDownloadButton";
import type { Receipt } from "@/lib/receipt-types";

export default function ReceiptsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      const res = await fetch(`/api/receipts?${params}`);
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setReceipts(data.receipts);
      setTotalCount(data.totalCount);
    } catch (err) {
      console.error("領収書取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleCapture = async (imageDataUrl: string) => {
    setUploading(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "登録に失敗しました");
        return;
      }

      await fetchReceipts();
    } catch {
      alert("登録に失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectMediaUrl = async (imageUrl: string) => {
    setUploading(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "登録に失敗しました");
        return;
      }

      await fetchReceipts();
    } catch {
      alert("登録に失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/receipts?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除失敗");
      await fetchReceipts();
    } catch {
      alert("削除に失敗しました");
    }
  };

  // 集計
  const totalAmount = receipts.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalTax = receipts.reduce((sum, r) => sum + r.tax, 0);
  const yearMonthLabel = `${year}年${month}月`;

  // 年の選択肢（現在年 ± 2年）
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          領収書管理
        </h2>

        {/* 撮影・アップロード */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            領収書を登録
          </h3>
          <ReceiptCapture onCapture={handleCapture} onSelectMediaUrl={handleSelectMediaUrl} disabled={uploading} />
          {uploading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <svg
                className="h-4 w-4 animate-spin"
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
              画像を解析中...
            </div>
          )}
        </section>

        {/* 年月セレクターと一括ダウンロード */}
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

          <BulkDownloadButton
            year={year}
            month={month}
            disabled={receipts.length === 0}
          />
        </section>

        {/* 月別集計 */}
        <MonthlyAggregation
          totalAmount={totalAmount}
          totalTax={totalTax}
          count={totalCount}
          yearMonth={yearMonthLabel}
        />

        {/* 領収書一覧 */}
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
            <ReceiptTable
              receipts={receipts}
              onDelete={handleDelete}
              onViewDetail={setSelectedReceipt}
            />
          )}
        </section>
      </main>

      {/* 詳細モーダル */}
      {selectedReceipt && (
        <ReceiptDetail
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
