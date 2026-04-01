"use client";

import { useState } from "react";
import type { Receipt, ReceiptItem } from "@/lib/receipt-types";
import { RECEIPT_CATEGORIES, PAYMENT_METHODS } from "@/lib/receipt-types";

interface ReceiptDetailProps {
  receipt: Receipt;
  onClose: () => void;
  onUpdated?: (updated: Receipt) => void;
}

export default function ReceiptDetail({
  receipt,
  onClose,
  onUpdated,
}: ReceiptDetailProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(receipt.date);
  const [storeName, setStoreName] = useState(receipt.storeName);
  const [totalAmount, setTotalAmount] = useState(String(receipt.totalAmount));
  const [tax, setTax] = useState(String(receipt.tax));
  const [category, setCategory] = useState(receipt.category);
  const [paymentMethod, setPaymentMethod] = useState(receipt.paymentMethod);
  const [memo, setMemo] = useState(receipt.memo);
  const [items, setItems] = useState<ReceiptItem[]>(
    receipt.items?.map((item) => ({ ...item })) ?? []
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: receipt.id,
          date,
          storeName,
          totalAmount: parseInt(totalAmount) || 0,
          tax: parseInt(tax) || 0,
          category,
          paymentMethod,
          memo,
          items,
        }),
      });
      if (!res.ok) throw new Error("更新失敗");
      const data = await res.json();
      onUpdated?.(data.receipt);
      setEditing(false);
    } catch {
      alert("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDate(receipt.date);
    setStoreName(receipt.storeName);
    setTotalAmount(String(receipt.totalAmount));
    setTax(String(receipt.tax));
    setCategory(receipt.category);
    setPaymentMethod(receipt.paymentMethod);
    setMemo(receipt.memo);
    setItems(receipt.items?.map((item) => ({ ...item })) ?? []);
    setEditing(false);
  };

  const updateItem = (
    index: number,
    field: keyof ReceiptItem,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]:
                field === "name" ? value : parseInt(value) || 0,
            }
          : item
      )
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { name: "", quantity: 1, price: 0 }]);
  };

  const inputClass =
    "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            領収書詳細
          </h3>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                編集
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </>
            )}
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
        </div>

        <div className="space-y-6 p-6">
          {/* Image */}
          {receipt.imageUrl && (
            <div className="flex justify-center">
              <img
                src={receipt.imageUrl}
                alt="領収書"
                className="max-h-72 rounded-lg border border-gray-200 object-contain dark:border-gray-700"
              />
            </div>
          )}

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">日付</span>
              {editing ? (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              ) : (
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {receipt.date || "-"}
                </p>
              )}
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">店舗名</span>
              {editing ? (
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className={inputClass}
                />
              ) : (
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {receipt.storeName || "-"}
                </p>
              )}
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">合計金額</span>
              {editing ? (
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className={inputClass}
                />
              ) : (
                <p className="font-medium text-blue-600 dark:text-blue-400">
                  ¥{receipt.totalAmount.toLocaleString()}
                </p>
              )}
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">税額</span>
              {editing ? (
                <input
                  type="number"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  className={inputClass}
                />
              ) : (
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  ¥{receipt.tax.toLocaleString()}
                </p>
              )}
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                カテゴリ
              </span>
              {editing ? (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="">未分類</option>
                  {RECEIPT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {receipt.category || "未分類"}
                </p>
              )}
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                支払方法
              </span>
              {editing ? (
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={inputClass}
                >
                  <option value="">未選択</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {receipt.paymentMethod || "-"}
                </p>
              )}
            </div>
          </div>

          {/* Items */}
          {(items.length > 0 || editing) && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                品目一覧
              </h4>
              {editing ? (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(i, "name", e.target.value)
                        }
                        placeholder="品名"
                        className={`flex-1 ${inputClass}`}
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(i, "quantity", e.target.value)
                        }
                        placeholder="数量"
                        className={`w-16 ${inputClass}`}
                      />
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) =>
                          updateItem(i, "price", e.target.value)
                        }
                        placeholder="金額"
                        className={`w-24 ${inputClass}`}
                      />
                      <button
                        onClick={() => removeItem(i)}
                        className="rounded p-1 text-red-400 hover:text-red-600"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addItem}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    + 品目を追加
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <th className="pb-2 text-left">品名</th>
                      <th className="pb-2 text-right">数量</th>
                      <th className="pb-2 text-right">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
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
              )}
            </div>
          )}

          {/* Memo */}
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              メモ
            </span>
            {editing ? (
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className={inputClass}
              />
            ) : (
              receipt.memo && (
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {receipt.memo}
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
