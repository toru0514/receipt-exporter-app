export interface ExportHistoryEntry {
  id: string;
  exportedAt: string;
  spreadsheetUrl: string;
  spreadsheetId: string;
  orderCount: number;
}

const STORAGE_KEY = "receipt-exporter-export-history";
const MAX_ENTRIES = 50;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getExportHistory(): ExportHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ExportHistoryEntry[];
  } catch {
    return [];
  }
}

export function addExportHistory(
  entry: Omit<ExportHistoryEntry, "id" | "exportedAt">
): ExportHistoryEntry {
  const newEntry: ExportHistoryEntry = {
    id: generateId(),
    exportedAt: new Date().toISOString(),
    ...entry,
  };

  const history = getExportHistory();
  history.unshift(newEntry);

  // 最大件数を超えた場合は古いエントリを削除
  const trimmed = history.slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage が使えない場合は無視
  }

  return newEntry;
}

export function clearExportHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
