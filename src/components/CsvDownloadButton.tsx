"use client";

import { ParsedOrder } from "@/lib/types";
import { downloadCsv } from "@/lib/csv-export";

interface CsvDownloadButtonProps {
  orders: ParsedOrder[];
  disabled?: boolean;
}

export default function CsvDownloadButton({
  orders,
  disabled = false,
}: CsvDownloadButtonProps) {
  const handleDownload = () => {
    if (orders.length === 0) return;
    downloadCsv(orders);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || orders.length === 0}
      className="rounded-md bg-gray-600 px-4 py-2.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50 sm:py-2 dark:bg-gray-500 dark:hover:bg-gray-600"
      title="CSVファイルとしてダウンロード"
    >
      CSV出力
    </button>
  );
}
