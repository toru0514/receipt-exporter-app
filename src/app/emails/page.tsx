"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useCallback, useMemo } from "react";

import { useToast } from "@/components/common/ToastProvider";
import EmailList from "@/components/EmailList";
import SortableTable from "@/components/SortableTable";
import ProgressBar from "@/components/ProgressBar";
import DateRangeFilter from "@/components/DateRangeFilter";
import SearchFilter from "@/components/SearchFilter";
import ExportHistory from "@/components/ExportHistory";
import CsvDownloadButton from "@/components/CsvDownloadButton";
import { EmailListSkeleton, OrderTableSkeleton } from "@/components/SkeletonLoader";
import { AmazonEmail, AnalysisResult, ParsedOrder } from "@/lib/types";
import { addExportHistory } from "@/lib/export-history";
import type { AmazonRegion } from "@/lib/providers";
import type { EmailSource } from "@/lib/types";

export default function EmailsPage() {
  const toast = useToast();
  const { data: session, status } = useSession();
  const [emails, setEmails] = useState<AmazonEmail[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<"emails" | "analyze" | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [analyzeProgress, setAnalyzeProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // 日付フィルタ（デフォルト: 1ヶ月前〜本日）
  const [dateAfter, setDateAfter] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateBefore, setDateBefore] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // 検索キーワードフィルタ
  const [searchKeyword, setSearchKeyword] = useState("");

  // リージョン選択
  const [region, setRegion] = useState<AmazonRegion>("jp");

  // プロバイダー選択
  const [provider, setProvider] = useState<EmailSource>("amazon");

  // エクスポート履歴リフレッシュ用
  const [historyKey, setHistoryKey] = useState(0);

  const fetchEmails = useCallback(async () => {
    setLoading("メールを取得中...");
    setLoadingPhase("emails");
    try {
      const params = new URLSearchParams();
      if (dateAfter) params.set("after", dateAfter);
      if (dateBefore) params.set("before", dateBefore);
      if (region !== "jp") params.set("region", region);
      params.set("provider", provider);

      const queryString = params.toString();
      const url = `/api/gmail${queryString ? `?${queryString}` : ""}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch emails");
      const data = await res.json();
      setEmails(data.emails);
      setSelectedIds(new Set(data.emails.map((e: AmazonEmail) => e.id)));
    } catch (error) {
      console.error(error);
      toast.error("メールの取得に失敗しました");
    } finally {
      setLoading(null);
      setLoadingPhase(null);
    }
  }, [dateAfter, dateBefore, region, provider, toast]);

  const analyzeEmails = useCallback(async () => {
    const selected = emails.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) {
      toast.info("メールを選択してください");
      return;
    }

    setLoading(`${selected.length}件のメールを解析中...`);
    setLoadingPhase("analyze");
    setResults([]);
    setAnalyzeProgress({ current: 0, total: selected.length });

    try {
      const res = await fetch("/api/analyze", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: selected.map((e) => ({ id: e.id, body: e.body, subject: e.subject })),
          source: provider,
        }),
      });
      if (!res.ok) throw new Error("Batch analysis failed");
      const data = await res.json();

      const newResults: AnalysisResult[] = selected.map((email) => {
        const batchItem = data.results.find(
          (r: { emailId: string; order: ParsedOrder | null; error?: string }) => r.emailId === email.id
        );
        if (batchItem?.order) {
          return { email, order: batchItem.order };
        }
        return {
          email,
          order: null,
          error: batchItem?.error ?? "解析結果が見つかりません",
        };
      });
      setResults(newResults);
      setAnalyzeProgress({ current: selected.length, total: selected.length });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setResults(selected.map((email) => ({ email, order: null, error: errorMsg })));
    }
    setLoading(null);
    setLoadingPhase(null);
  }, [emails, selectedIds, provider, toast]);

  const exportToSheets = useCallback(async () => {
    const orders = results
      .filter((r) => r.order)
      .map((r) => r.order as ParsedOrder);
    if (orders.length === 0) {
      toast.info("エクスポートするデータがありません");
      return;
    }

    setLoading("スプレッドシートに書き出し中...");
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orders,
          spreadsheetId: spreadsheetId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      setSpreadsheetUrl(data.url);
      if (!spreadsheetId) setSpreadsheetId(data.spreadsheetId);

      // エクスポート履歴を保存
      addExportHistory({
        spreadsheetUrl: data.url,
        spreadsheetId: data.spreadsheetId,
        orderCount: orders.length,
      });
      setHistoryKey((prev) => prev + 1);

      toast.success(`${data.updatedRows}行をエクスポートしました`);
    } catch (error) {
      console.error(error);
      toast.error("エクスポートに失敗しました");
    } finally {
      setLoading(null);
    }
  }, [results, spreadsheetId, toast]);

  const toggleEmail = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
    }
  };

  const handleDateApply = useCallback((after: string, before: string) => {
    setDateAfter(after);
    setDateBefore(before);
  }, []);

  const handleSearch = useCallback((keyword: string) => {
    setSearchKeyword(keyword);
  }, []);

  // 検索キーワードで解析結果をフィルタ
  const filteredResults = useMemo(() => {
    if (!searchKeyword.trim()) return results;
    const kw = searchKeyword.toLowerCase();
    return results.filter((r) => {
      if (!r.order) return false;
      const order = r.order;
      if (order.items.some((item) => item.name.toLowerCase().includes(kw))) {
        return true;
      }
      if (order.orderNumber.toLowerCase().includes(kw)) return true;
      if (String(order.totalAmount).includes(kw)) return true;
      if (order.items.some((item) => String(item.price).includes(kw))) {
        return true;
      }
      return false;
    });
  }, [results, searchKeyword]);

  const saveToMicroCMS = useCallback(async () => {
    const orders = results
      .filter((r) => r.order)
      .map((r) => r.order as ParsedOrder);
    if (orders.length === 0) {
      toast.info("保存するデータがありません");
      return;
    }

    setLoading("microCMSに保存中...");
    try {
      const res = await fetch("/api/receipts/save-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      const data = await res.json();
      toast.success(
        `保存完了: ${data.saved}件保存、${data.skipped}件スキップ（重複）${data.errors > 0 ? `、${data.errors}件エラー` : ""}`
      );
    } catch (error) {
      console.error(error);
      toast.error("microCMSへの保存に失敗しました");
    } finally {
      setLoading(null);
    }
  }, [results, toast]);

  // CSV用の注文データ
  const exportableOrders = useMemo(() => {
    return filteredResults
      .filter((r) => r.order)
      .map((r) => r.order as ParsedOrder);
  }, [filteredResults]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            メール解析
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Googleアカウントでログインして、メール解析機能を利用してください
          </p>
        </div>
        <button
          onClick={() => signIn("google")}
          className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium shadow-md hover:shadow-lg dark:bg-gray-800 dark:text-gray-200 dark:shadow-gray-900 dark:hover:bg-gray-700"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Googleアカウントでログイン
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
      {/* Provider Tab */}
      <div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
        {(["amazon", "rakuten"] as const).map((p) => (
          <button
            key={p}
            onClick={() => {
              if (p !== provider) {
                setProvider(p);
                setEmails([]);
                setResults([]);
                setSelectedIds(new Set());
                setSpreadsheetUrl(null);
              }
            }}
            className={`px-4 py-2 text-sm font-medium ${
              provider === p
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            {p === "amazon" ? "Amazon" : "楽天市場"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mb-4 space-y-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <p>{loading}</p>
          {loadingPhase === "analyze" && analyzeProgress.total > 0 && (
            <ProgressBar
              current={analyzeProgress.current}
              total={analyzeProgress.total}
              label="解析進捗"
            />
          )}
        </div>
      )}

      {/* Step 1: Fetch Emails */}
      <section className="mb-4 sm:mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">
            1. {provider === "amazon" ? "Amazon" : "楽天市場"} メールを取得
          </h2>
          <button
            onClick={fetchEmails}
            disabled={!!loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto sm:py-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            メールを取得
          </button>
        </div>

        {/* フィルタパネル */}
        <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            {provider === "amazon" && (
              <div>
                <label
                  htmlFor="region-select"
                  className="block text-xs font-medium text-gray-600 dark:text-gray-400"
                >
                  リージョン
                </label>
                <select
                  id="region-select"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as AmazonRegion)}
                  disabled={!!loading}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 sm:w-auto dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="jp">Amazon.co.jp</option>
                  <option value="us">Amazon.com</option>
                  <option value="all">すべて</option>
                </select>
              </div>
            )}
            <DateRangeFilter onApply={handleDateApply} disabled={!!loading} />
          </div>
        </div>

        {loadingPhase === "emails" && emails.length === 0 && (
          <div className="mt-3">
            <EmailListSkeleton />
          </div>
        )}
        {emails.length > 0 && (
          <div className="mt-3">
            <EmailList
              emails={emails}
              selectedIds={selectedIds}
              onToggle={toggleEmail}
              onSelectAll={selectAll}
              provider={provider}
            />
          </div>
        )}
      </section>

      {/* Step 2: Analyze */}
      {emails.length > 0 && (
        <section className="mb-4 sm:mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">
              2. AI解析で注文情報を抽出
            </h2>
            <button
              onClick={analyzeEmails}
              disabled={!!loading || selectedIds.size === 0}
              className="w-full rounded-md bg-green-600 px-4 py-2.5 text-sm text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto sm:py-2 dark:bg-green-500 dark:hover:bg-green-600"
            >
              選択したメールを解析 ({selectedIds.size}件)
            </button>
          </div>

          {/* 解析結果の検索フィルタ */}
          {results.length > 0 && (
            <div className="mt-3">
              <SearchFilter onSearch={handleSearch} disabled={!!loading} />
            </div>
          )}

          {loadingPhase === "analyze" && results.length === 0 && (
            <div className="mt-3">
              <OrderTableSkeleton />
            </div>
          )}
          {filteredResults.length > 0 && (
            <div className="mt-3">
              <SortableTable results={filteredResults} />
              {searchKeyword && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {filteredResults.length}/{results.length}件の結果を表示中
                </p>
              )}
            </div>
          )}
          {searchKeyword && filteredResults.length === 0 && results.length > 0 && (
            <div className="mt-3 rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              検索条件に一致する結果がありません
            </div>
          )}
        </section>
      )}

      {/* Step 3: Export */}
      {results.some((r) => r.order) && (
        <section className="mb-4 sm:mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">
              3. エクスポート
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                placeholder="スプレッドシートID（空欄で新規作成）"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm sm:w-auto sm:py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={exportToSheets}
                  disabled={!!loading}
                  className="flex-1 rounded-md bg-orange-600 px-4 py-2.5 text-sm text-white hover:bg-orange-700 disabled:opacity-50 sm:flex-none sm:py-2 dark:bg-orange-500 dark:hover:bg-orange-600"
                >
                  Sheetsエクスポート
                </button>
                <CsvDownloadButton
                  orders={exportableOrders}
                  disabled={!!loading}
                />
                <button
                  onClick={saveToMicroCMS}
                  disabled={!!loading}
                  className="flex-1 rounded-md bg-purple-600 px-4 py-2.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50 sm:flex-none sm:py-2 dark:bg-purple-500 dark:hover:bg-purple-600"
                >
                  microCMSに保存
                </button>
              </div>
            </div>
          </div>
          {spreadsheetUrl && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-700 hover:underline dark:text-green-400"
              >
                スプレッドシートを開く →
              </a>
            </div>
          )}
        </section>
      )}

      {/* Export History */}
      <section className="mb-4 sm:mb-6" key={historyKey}>
        <ExportHistory />
      </section>
    </main>
  );
}
