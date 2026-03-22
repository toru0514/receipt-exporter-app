"use client";

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${className ?? ""}`}
    />
  );
}

/**
 * メール一覧のスケルトンローダー
 */
export function EmailListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="flex items-center gap-2">
          <SkeletonPulse className="h-4 w-4" />
          <SkeletonPulse className="h-4 w-24" />
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-3">
            <SkeletonPulse className="mt-1 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonPulse className="h-4 w-3/4" />
              <SkeletonPulse className="h-3 w-32" />
              <SkeletonPulse className="h-3 w-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 解析結果テーブルのスケルトンローダー
 */
export function OrderTableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
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
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td className="px-4 py-2">
                <SkeletonPulse className="h-4 w-20" />
              </td>
              <td className="px-4 py-2">
                <SkeletonPulse className="h-4 w-36" />
              </td>
              <td className="px-4 py-2">
                <SkeletonPulse className="h-4 w-48" />
              </td>
              <td className="px-4 py-2">
                <SkeletonPulse className="ml-auto h-4 w-16" />
              </td>
              <td className="px-4 py-2">
                <SkeletonPulse className="ml-auto h-4 w-14" />
              </td>
              <td className="px-4 py-2">
                <SkeletonPulse className="h-4 w-10" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
