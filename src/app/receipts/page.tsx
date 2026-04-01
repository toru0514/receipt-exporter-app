"use client";

import { useState, useEffect, useCallback } from "react";

import ReceiptCapture from "@/components/receipt/ReceiptCapture";
import type { SelectedImage } from "@/components/receipt/ReceiptCapture";
import ReceiptTable from "@/components/receipt/ReceiptTable";
import MonthlyAggregation from "@/components/receipt/MonthlyAggregation";
import ReceiptDetail from "@/components/receipt/ReceiptDetail";
import BulkDownloadButton from "@/components/receipt/BulkDownloadButton";
import type { Receipt } from "@/lib/receipt-types";

/** 画像をリサイズして圧縮する（Vercelの4.5MBリクエスト制限対策） */
function compressImage(dataUrl: string, maxWidth = 1600): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = dataUrl;
  });
}

export default function ReceiptsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<"year" | "month">("year");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (viewMode === "month") {
        params.set("month", String(month));
      }
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
  }, [year, month, viewMode]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleAnalyze = async (images: SelectedImage[]) => {
    setUploading(true);
    setUploadProgress({ current: 0, total: images.length });
    let successCount = 0;
    let errorCount = 0;
    const resultDates: string[] = [];

    for (let i = 0; i < images.length; i++) {
      setUploadProgress({ current: i + 1, total: images.length });
      try {
        const compressed = await compressImage(images[i].dataUrl);
        const res = await fetch("/api/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: compressed,
            imageUrl: images[i].microCmsUrl,
          }),
        });

        if (!res.ok) {
          errorCount++;
        } else {
          successCount++;
          const data = await res.json();
          if (data.analysis?.date) {
            resultDates.push(data.analysis.date);
          }
        }
      } catch {
        errorCount++;
      }
    }

    if (errorCount > 0) {
      alert(`${successCount}件成功、${errorCount}件失敗`);
    } else if (successCount > 0) {
      const hasOtherPeriod = resultDates.some((date) => {
        const d = new Date(date);
        if (viewMode === "year") return d.getFullYear() !== year;
        return d.getFullYear() !== year || d.getMonth() + 1 !== month;
      });
      if (hasOtherPeriod) {
        alert(`${successCount}件の解析が完了しました。一部のレシートは表示期間外に登録されています。`);
      } else {
        alert(`${successCount}件の解析が完了しました。`);
      }
    }
    await fetchReceipts();
    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
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
  const yearMonthLabel = viewMode === "year" ? `${year}年` : `${year}年${month}月`;

  // 年の選択肢（現在年 ± 2年）
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          領収書管理
        </h2>

        {/* 撮影・アップロード */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            領収書を登録
          </h3>
          <ReceiptCapture onAnalyze={handleAnalyze} disabled={uploading} />
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
              画像を解析中... ({uploadProgress.current}/{uploadProgress.total})
            </div>
          )}
        </section>

        {/* 年月セレクターと一括ダウンロード */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600">
              <button
                onClick={() => setViewMode("year")}
                className={`px-3 py-2 text-sm font-medium rounded-l-lg ${
                  viewMode === "year"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                年
              </button>
              <button
                onClick={() => setViewMode("month")}
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
              onChange={(e) => setYear(Number(e.target.value))}
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
                onChange={(e) => setMonth(Number(e.target.value))}
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

          <div className="flex gap-2">
            <button
              onClick={async () => {
                const params = new URLSearchParams({ year: String(year) });
                if (viewMode === "month") {
                  params.set("month", String(month));
                }
                const res = await fetch(`/api/receipts/csv?${params}`);
                if (!res.ok) {
                  alert("CSVダウンロードに失敗しました");
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = viewMode === "year"
                  ? `receipts_${year}.csv`
                  : `receipts_${year}_${String(month).padStart(2, "0")}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              disabled={receipts.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              CSVダウンロード
            </button>
            <BulkDownloadButton
              year={year}
              month={month}
              disabled={receipts.length === 0}
            />
          </div>
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
    </>
  );
}
