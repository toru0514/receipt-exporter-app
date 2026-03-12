"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useCallback } from "react";
import Header from "@/components/Header";
import EmailList from "@/components/EmailList";
import OrderTable from "@/components/OrderTable";
import { AmazonEmail, AnalysisResult, ParsedOrder } from "@/lib/types";

export default function Home() {
  const { data: session, status } = useSession();
  const [emails, setEmails] = useState<AmazonEmail[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState("");

  const fetchEmails = useCallback(async () => {
    setLoading("メールを取得中...");
    try {
      const res = await fetch("/api/gmail");
      if (!res.ok) throw new Error("Failed to fetch emails");
      const data = await res.json();
      setEmails(data.emails);
      setSelectedIds(new Set(data.emails.map((e: AmazonEmail) => e.id)));
    } catch (error) {
      console.error(error);
      alert("メールの取得に失敗しました");
    } finally {
      setLoading(null);
    }
  }, []);

  const analyzeEmails = useCallback(async () => {
    const selected = emails.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) {
      alert("メールを選択してください");
      return;
    }

    setLoading(`${selected.length}件のメールを解析中...`);
    setResults([]);

    const newResults: AnalysisResult[] = [];
    for (const email of selected) {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailHtml: email.body }),
        });
        if (!res.ok) throw new Error("Analysis failed");
        const data = await res.json();
        newResults.push({ email, order: data.order });
      } catch (error) {
        newResults.push({
          email,
          order: null,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      setResults([...newResults]);
    }
    setLoading(null);
  }, [emails, selectedIds]);

  const exportToSheets = useCallback(async () => {
    const orders = results
      .filter((r) => r.order)
      .map((r) => r.order as ParsedOrder);
    if (orders.length === 0) {
      alert("エクスポートするデータがありません");
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
      alert(`${data.updatedRows}行をエクスポートしました`);
    } catch (error) {
      console.error(error);
      alert("エクスポートに失敗しました");
    } finally {
      setLoading(null);
    }
  }, [results, spreadsheetId]);

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

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Amazon 経費管理
          </h1>
          <p className="mt-2 text-gray-600">
            Amazonの注文確認メールから経費情報を自動抽出し、
            <br />
            Google Sheetsに記録します
          </p>
        </div>
        <button
          onClick={() => signIn("google")}
          className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium shadow-md hover:shadow-lg"
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {loading && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            {loading}
          </div>
        )}

        {/* Step 1: Fetch Emails */}
        <section className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              1. Amazon メールを取得
            </h2>
            <button
              onClick={fetchEmails}
              disabled={!!loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              メールを取得
            </button>
          </div>
          {emails.length > 0 && (
            <div className="mt-3">
              <EmailList
                emails={emails}
                selectedIds={selectedIds}
                onToggle={toggleEmail}
                onSelectAll={selectAll}
              />
            </div>
          )}
        </section>

        {/* Step 2: Analyze */}
        {emails.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                2. AI解析で注文情報を抽出
              </h2>
              <button
                onClick={analyzeEmails}
                disabled={!!loading || selectedIds.size === 0}
                className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                選択したメールを解析 ({selectedIds.size}件)
              </button>
            </div>
            {results.length > 0 && (
              <div className="mt-3">
                <OrderTable results={results} />
              </div>
            )}
          </section>
        )}

        {/* Step 3: Export */}
        {results.some((r) => r.order) && (
          <section className="mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                3. スプレッドシートにエクスポート
              </h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="スプレッドシートID（空欄で新規作成）"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={exportToSheets}
                  disabled={!!loading}
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  エクスポート
                </button>
              </div>
            </div>
            {spreadsheetUrl && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-700 hover:underline"
                >
                  スプレッドシートを開く →
                </a>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
