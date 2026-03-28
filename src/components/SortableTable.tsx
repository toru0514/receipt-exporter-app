"use client";

import { useState, useMemo, useCallback } from "react";
import { AnalysisResult, EmailSource } from "@/lib/types";
import { getDefaultReceiptUrl } from "@/lib/receipt-url";

interface SortableTableProps {
  results: AnalysisResult[];
}

type SortKey = "orderDate" | "totalAmount" | "itemName";
type SortDirection = "asc" | "desc";

interface FlatRow {
  emailId: string;
  emailSubject: string;
  orderDate: string;
  orderNumber: string;
  itemName: string;
  itemPrice: number;
  tax: number;
  receiptUrl: string;
  source: EmailSource;
}

function flattenResults(results: AnalysisResult[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const result of results) {
    if (!result.order) continue;
    const order = result.order;
    const source = order.source;
    for (const item of order.items) {
      rows.push({
        emailId: result.email.id,
        emailSubject: result.email.subject,
        orderDate: order.orderDate,
        orderNumber: order.orderNumber,
        itemName: item.name,
        itemPrice: item.price,
        tax: order.tax,
        receiptUrl: order.receiptUrl || getDefaultReceiptUrl(source, order.orderNumber),
        source,
      });
    }
  }
  return rows;
}

function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) {
    return <span className="ml-1 text-gray-300 dark:text-gray-600">↕</span>;
  }
  return (
    <span className="ml-1">
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}

export default function SortableTable({ results }: SortableTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("orderDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const successResults = results.filter((r) => r.order);
  const errorResults = results.filter((r) => r.error);

  const rows = useMemo(() => flattenResults(successResults), [successResults]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "orderDate":
          cmp = a.orderDate.localeCompare(b.orderDate);
          break;
        case "totalAmount":
          cmp = a.itemPrice - b.itemPrice;
          break;
        case "itemName":
          cmp = a.itemName.localeCompare(b.itemName);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, sortKey, sortDirection]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDirection("asc");
      return key;
    });
  }, []);

  if (results.length === 0) return null;

  return (
    <div className="space-y-4">
      {errorResults.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            {errorResults.length}件のメールの解析に失敗しました
          </p>
          <ul className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errorResults.map((r) => (
              <li key={r.email.id}>
                {r.email.subject}: {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sortedRows.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => handleSort("orderDate")}
                    >
                      注文日
                      <SortIndicator active={sortKey === "orderDate"} direction={sortDirection} />
                    </th>
                    <th className="whitespace-nowrap px-4 py-2">注文番号</th>
                    <th className="whitespace-nowrap px-4 py-2">メール件名</th>
                    <th className="whitespace-nowrap px-4 py-2">ソース</th>
                    <th
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => handleSort("itemName")}
                    >
                      商品名
                      <SortIndicator active={sortKey === "itemName"} direction={sortDirection} />
                    </th>
                    <th
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-2 text-right hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => handleSort("totalAmount")}
                    >
                      金額
                      <SortIndicator active={sortKey === "totalAmount"} direction={sortDirection} />
                    </th>
                    <th className="whitespace-nowrap px-4 py-2 text-right">消費税</th>
                    <th className="whitespace-nowrap px-4 py-2">領収書</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sortedRows.map((row, idx) => (
                    <tr
                      key={`${row.emailId}-${idx}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="whitespace-nowrap px-4 py-2 dark:text-gray-200">
                        {row.orderDate}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs dark:text-gray-200">
                        {row.orderNumber}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2 text-xs text-gray-500 dark:text-gray-400" title={row.emailSubject}>
                        {row.emailSubject}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 dark:text-gray-200">
                        {row.source === "amazon" ? "Amazon" : "楽天"}
                      </td>
                      <td className="px-4 py-2 dark:text-gray-200">{row.itemName}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right dark:text-gray-200">
                        ¥{row.itemPrice.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right dark:text-gray-200">
                        ¥{row.tax.toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <a
                          href={row.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          開く
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
