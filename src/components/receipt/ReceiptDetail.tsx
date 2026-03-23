"use client";

import type { Receipt } from "@/lib/receipt-types";

interface ReceiptDetailProps {
  receipt: Receipt;
  onClose: () => void;
}

export default function ReceiptDetail({ receipt, onClose }: ReceiptDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            領収書詳細
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 画像 */}
          {receipt.imageUrl && (
            <div className="flex justify-center">
              <img
                src={receipt.imageUrl}
                alt="領収書"
                className="max-h-72 rounded-lg border border-gray-200 object-contain dark:border-gray-700"
              />
            </div>
          )}

          {/* 基本情報 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">日付</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {receipt.date || "-"}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">店舗名</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {receipt.storeName || "-"}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">合計金額</span>
              <p className="font-medium text-blue-600 dark:text-blue-400">
                ¥{receipt.totalAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">税額</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                ¥{receipt.tax.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">カテゴリ</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {receipt.category || "未分類"}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">支払方法</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {receipt.paymentMethod || "-"}
              </p>
            </div>
          </div>

          {/* 品目一覧 */}
          {receipt.items && receipt.items.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                品目一覧
              </h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="pb-2 text-left">品名</th>
                    <th className="pb-2 text-right">数量</th>
                    <th className="pb-2 text-right">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 text-gray-900 dark:text-gray-100">
                        {item.name}
                      </td>
                      <td className="py-2 text-right text-gray-600 dark:text-gray-400">
                        {item.quantity}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-gray-100">
                        ¥{item.price.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* メモ */}
          {receipt.memo && (
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                メモ
              </span>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {receipt.memo}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
