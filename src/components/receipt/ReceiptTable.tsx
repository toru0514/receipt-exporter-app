"use client";

import type { Receipt } from "@/lib/receipt-types";

interface ReceiptTableProps {
  receipts: Receipt[];
  onDelete?: (id: string) => void;
  onViewDetail?: (receipt: Receipt) => void;
}

export default function ReceiptTable({
  receipts,
  onDelete,
  onViewDetail,
}: ReceiptTableProps) {
  if (receipts.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        領収書がありません
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <th className="px-4 py-3">日付</th>
            <th className="px-4 py-3">店舗名</th>
            <th className="px-4 py-3 text-right">合計金額</th>
            <th className="px-4 py-3 text-right">税額</th>
            <th className="px-4 py-3">カテゴリ</th>
            <th className="px-4 py-3">支払方法</th>
            <th className="px-4 py-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr
              key={receipt.id}
              className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
            >
              <td className="whitespace-nowrap px-4 py-3 text-gray-900 dark:text-gray-100">
                {receipt.date}
              </td>
              <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                {receipt.storeName || "-"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                ¥{receipt.totalAmount.toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                ¥{receipt.tax.toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {receipt.category || "未分類"}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                {receipt.paymentMethod || "-"}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  {onViewDetail && (
                    <button
                      onClick={() => onViewDetail(receipt)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      title="詳細"
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        if (confirm("この領収書を削除しますか？")) {
                          onDelete(receipt.id);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      title="削除"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
