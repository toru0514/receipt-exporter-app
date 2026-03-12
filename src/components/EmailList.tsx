"use client";

import { AmazonEmail } from "@/lib/types";

interface EmailListProps {
  emails: AmazonEmail[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}

export default function EmailList({
  emails,
  selectedIds,
  onToggle,
  onSelectAll,
}: EmailListProps) {
  if (emails.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        Amazonからの注文確認メールが見つかりませんでした
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selectedIds.size === emails.length}
            onChange={onSelectAll}
            className="rounded"
          />
          すべて選択 ({selectedIds.size}/{emails.length})
        </label>
      </div>
      <ul className="divide-y divide-gray-100">
        {emails.map((email) => (
          <li key={email.id} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={selectedIds.has(email.id)}
              onChange={() => onToggle(email.id)}
              className="mt-1 rounded"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {email.subject}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{email.date}</p>
              <p className="mt-1 truncate text-xs text-gray-400">
                {email.snippet}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
