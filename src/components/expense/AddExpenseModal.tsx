"use client";

import { useState, useEffect } from "react";
import type { Expense, ExpenseCreateInput } from "@/lib/expense-types";
import ClientCombobox from "@/components/income/ClientCombobox";
import MultiImageUploader from "@/components/common/MultiImageUploader";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: ExpenseCreateInput) => Promise<void>;
  payees: string[];
  /** 編集対象（指定時は編集モード） */
  editTarget?: Expense | null;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AddExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  payees,
  editTarget,
}: AddExpenseModalProps) {
  const [date, setDate] = useState(todayString());
  const [payeeName, setPayeeName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEditMode = !!editTarget;

  // 編集対象が変わったらフォームを初期化
  useEffect(() => {
    if (editTarget) {
      setDate(editTarget.date);
      setPayeeName(editTarget.payeeName);
      setDescription(editTarget.description);
      setAmount(String(editTarget.amount));
      setNotes(editTarget.notes);
      setPhotoUrls(editTarget.photoUrls);
      setError("");
    } else if (isOpen) {
      setDate(todayString());
      setPayeeName("");
      setDescription("");
      setAmount("");
      setNotes("");
      setPhotoUrls([]);
      setError("");
    }
  }, [editTarget, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!date || !payeeName.trim() || !amount) {
      setError("日付、支払先、金額は必須です");
      return;
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("金額は正の数値を入力してください");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        date,
        payeeName: payeeName.trim(),
        description: description.trim(),
        amount: parsedAmount,
        notes: notes.trim(),
        photoUrls: photoUrls.filter((u) => u !== ""),
      });
      // Reset form
      setDate(todayString());
      setPayeeName("");
      setDescription("");
      setAmount("");
      setNotes("");
      setPhotoUrls([]);
      onClose();
    } catch {
      setError(isEditMode ? "更新に失敗しました" : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEditMode ? "出金を編集" : "出金を追加"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              日付 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              支払先 <span className="text-red-500">*</span>
            </label>
            <ClientCombobox
              value={payeeName}
              onChange={setPayeeName}
              clients={payees}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              内容
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: 材料費"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              金額 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="1"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              備考
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="メモなど"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              写真
            </label>
            <MultiImageUploader values={photoUrls} onChange={setPhotoUrls} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              {submitting
                ? isEditMode ? "更新中..." : "登録中..."
                : isEditMode ? "更新" : "登録"}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
