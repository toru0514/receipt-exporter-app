"use client";

import type { Expense } from "@/lib/expense-types";

interface ExpenseTableProps {
  expenses: Expense[];
  onDelete?: (id: string) => void;
}

export default function ExpenseTable({ expenses, onDelete }: ExpenseTableProps) {
  if (expenses.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        出金データがありません
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <th className="px-4 py-3">日付</th>
            <th className="px-4 py-3">支払先</th>
            <th className="px-4 py-3">内容</th>
            <th className="px-4 py-3 text-right">金額</th>
            <th className="px-4 py-3">備考</th>
            <th className="px-4 py-3 text-center">写真</th>
            <th className="px-4 py-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr
              key={expense.id}
              className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
            >
              <td className="whitespace-nowrap px-4 py-3 text-gray-900 dark:text-gray-100">
                {expense.date}
              </td>
              <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                {expense.payeeName}
              </td>
              <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                {expense.description || "-"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                ¥{expense.amount.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                {expense.notes || "-"}
              </td>
              <td className="px-4 py-3 text-center">
                {expense.photoUrl ? (
                  <a
                    href={expense.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    title="写真を表示"
                  >
                    <svg
                      className="mx-auto h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </a>
                ) : (
                  <span className="text-gray-400 dark:text-gray-600">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {onDelete && (
                  <button
                    onClick={() => {
                      if (confirm("この出金データを削除しますか？")) {
                        onDelete(expense.id);
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
