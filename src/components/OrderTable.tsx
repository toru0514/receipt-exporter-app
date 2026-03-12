"use client";

import { AnalysisResult } from "@/lib/types";

interface OrderTableProps {
  results: AnalysisResult[];
}

export default function OrderTable({ results }: OrderTableProps) {
  const successResults = results.filter((r) => r.order);
  const errorResults = results.filter((r) => r.error);

  if (results.length === 0) return null;

  return (
    <div className="space-y-4">
      {errorResults.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">
            {errorResults.length}件のメールの解析に失敗しました
          </p>
          <ul className="mt-1 text-xs text-red-600">
            {errorResults.map((r) => (
              <li key={r.email.id}>
                {r.email.subject}: {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {successResults.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">注文日</th>
                <th className="px-4 py-2">注文番号</th>
                <th className="px-4 py-2">商品名</th>
                <th className="px-4 py-2 text-right">金額</th>
                <th className="px-4 py-2 text-right">消費税</th>
                <th className="px-4 py-2">領収書</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {successResults.map((result) =>
                result.order!.items.map((item, idx) => (
                  <tr key={`${result.email.id}-${idx}`} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-2">
                      {result.order!.orderDate}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      {result.order!.orderNumber}
                    </td>
                    <td className="px-4 py-2">{item.name}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      ¥{item.price.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      ¥{result.order!.tax.toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <a
                        href={
                          result.order!.receiptUrl ||
                          `https://www.amazon.co.jp/gp/css/summary/print.html?orderID=${result.order!.orderNumber}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        開く
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
