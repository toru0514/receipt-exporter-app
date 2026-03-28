"use client";

import { useState, useCallback, useMemo } from "react";
import { AnalysisResult, ParsedOrder, OrderItem } from "@/lib/types";
import {
  validateParsedOrder,
  getIssuesForField,
  ValidationReport,
  FieldIssue,
} from "@/lib/data-validator";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface EditableOrderTableProps {
  results: AnalysisResult[];
  onConfirm?: (updatedResults: AnalysisResult[]) => void;
}

interface EditingCell {
  emailId: string;
  field: string;
  itemIndex?: number;
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function severityColor(issues: FieldIssue[]): string {
  if (issues.some((i) => i.severity === "error")) {
    return "bg-red-50 border-red-300";
  }
  if (issues.some((i) => i.severity === "warning")) {
    return "bg-yellow-50 border-yellow-300";
  }
  return "";
}

function severityTooltip(issues: FieldIssue[]): string {
  return issues.map((i) => i.message).join("\n");
}

// ---------------------------------------------------------------------------
// 編集可能セルコンポーネント
// ---------------------------------------------------------------------------

interface EditableCellProps {
  value: string;
  issues: FieldIssue[];
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (newValue: string) => void;
  onCancel: () => void;
  className?: string;
  inputType?: "text" | "number";
}

function EditableCell({
  value,
  issues,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
  className = "",
  inputType = "text",
}: EditableCellProps) {
  const [draft, setDraft] = useState(value);

  const bgClass = severityColor(issues);
  const tooltip = severityTooltip(issues);

  if (editing) {
    return (
      <td className={`px-4 py-1 ${className}`}>
        <input
          type={inputType}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onCommit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit(draft);
            if (e.key === "Escape") {
              setDraft(value);
              onCancel();
            }
          }}
          autoFocus
          className="w-full rounded border border-blue-400 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
    );
  }

  return (
    <td
      className={`cursor-pointer px-4 py-2 ${bgClass} ${className}`}
      title={tooltip || undefined}
      onClick={onStartEdit}
    >
      <div className="flex items-center gap-1">
        <span>{value}</span>
        {issues.length > 0 && (
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              issues.some((i) => i.severity === "error")
                ? "bg-red-500"
                : "bg-yellow-500"
            }`}
          />
        )}
      </div>
    </td>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function EditableOrderTable({
  results,
  onConfirm,
}: EditableOrderTableProps) {
  // 編集可能なデータのコピーを管理
  const [editedResults, setEditedResults] = useState<AnalysisResult[]>(
    () => JSON.parse(JSON.stringify(results)) as AnalysisResult[]
  );

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const successResults = useMemo(
    () => editedResults.filter((r) => r.order),
    [editedResults]
  );
  const errorResults = useMemo(
    () => editedResults.filter((r) => r.error),
    [editedResults]
  );

  // 各注文のバリデーション結果をキャッシュ
  const validationMap = useMemo(() => {
    const map = new Map<string, ValidationReport>();
    for (const result of successResults) {
      if (result.order) {
        map.set(result.email.id, validateParsedOrder(result.order));
      }
    }
    return map;
  }, [successResults]);

  // バリデーションの総合結果
  const overallValid = useMemo(() => {
    for (const report of validationMap.values()) {
      if (!report.valid) return false;
    }
    return true;
  }, [validationMap]);

  const totalWarnings = useMemo(() => {
    let count = 0;
    for (const report of validationMap.values()) {
      count += report.issues.filter((i) => i.severity === "warning").length;
    }
    return count;
  }, [validationMap]);

  const totalErrors = useMemo(() => {
    let count = 0;
    for (const report of validationMap.values()) {
      count += report.issues.filter((i) => i.severity === "error").length;
    }
    return count;
  }, [validationMap]);

  // ---------------------------------------------------------------------------
  // 編集操作
  // ---------------------------------------------------------------------------

  const startEdit = useCallback((emailId: string, field: string, itemIndex?: number) => {
    setEditingCell({ emailId, field, itemIndex });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const commitEdit = useCallback(
    (emailId: string, field: string, newValue: string, itemIndex?: number) => {
      setEditedResults((prev) =>
        prev.map((r) => {
          if (r.email.id !== emailId || !r.order) return r;

          const updated: ParsedOrder = { ...r.order };

          if (field === "orderDate") {
            updated.orderDate = newValue;
          } else if (field === "orderNumber") {
            updated.orderNumber = newValue;
          } else if (field === "totalAmount") {
            const num = Number(newValue);
            if (!isNaN(num)) updated.totalAmount = num;
          } else if (field === "tax") {
            const num = Number(newValue);
            if (!isNaN(num)) updated.tax = num;
          } else if (
            itemIndex !== undefined &&
            updated.items[itemIndex]
          ) {
            const updatedItems: OrderItem[] = [...updated.items];
            const item = { ...updatedItems[itemIndex] };

            if (field === "itemName") {
              item.name = newValue;
            } else if (field === "itemPrice") {
              const num = Number(newValue);
              if (!isNaN(num)) item.price = num;
            } else if (field === "itemQuantity") {
              const num = Number(newValue);
              if (!isNaN(num)) item.quantity = num;
            }

            updatedItems[itemIndex] = item;
            updated.items = updatedItems;
          }

          return { ...r, order: updated };
        })
      );
      setEditingCell(null);
    },
    []
  );

  const handleConfirm = useCallback(() => {
    setConfirmed(true);
    onConfirm?.(editedResults);
  }, [editedResults, onConfirm]);

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------

  if (editedResults.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* バリデーションサマリー */}
      {successResults.length > 0 && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            totalErrors > 0
              ? "border-red-200 bg-red-50 text-red-800"
              : totalWarnings > 0
                ? "border-yellow-200 bg-yellow-50 text-yellow-800"
                : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {totalErrors > 0 && (
            <p>
              {totalErrors}件のエラーがあります。セルをクリックして修正してください。
            </p>
          )}
          {totalWarnings > 0 && totalErrors === 0 && (
            <p>
              {totalWarnings}件の警告があります。内容を確認してください。
            </p>
          )}
          {totalErrors === 0 && totalWarnings === 0 && (
            <p>全てのデータが正常です。</p>
          )}
        </div>
      )}

      {/* エラーメール一覧 */}
      {errorResults.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">
            {errorResults.length}件のメールの解析に失敗しました
          </p>
          <ul className="mt-1 text-xs text-red-600">
            {errorResults.map((r) => (
              <li key={r.email.id}>
                {r.email.subject}: {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 編集可能テーブル */}
      {successResults.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">注文日</th>
                <th className="px-4 py-2">注文番号</th>
                <th className="px-4 py-2">商品名</th>
                <th className="px-4 py-2 text-right">数量</th>
                <th className="px-4 py-2 text-right">金額</th>
                <th className="px-4 py-2 text-right">消費税</th>
                <th className="px-4 py-2 text-right">合計</th>
                <th className="px-4 py-2">領収書</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {successResults.map((result) => {
                const order = result.order!;
                const report = validationMap.get(result.email.id);

                return order.items.map((item, idx) => {
                  const isEditing = (field: string, itemIdx?: number) =>
                    editingCell?.emailId === result.email.id &&
                    editingCell?.field === field &&
                    editingCell?.itemIndex === itemIdx;

                  return (
                    <tr
                      key={`${result.email.id}-${idx}`}
                      className="hover:bg-gray-50"
                    >
                      {/* 注文日 */}
                      <EditableCell
                        value={order.orderDate}
                        issues={
                          report
                            ? getIssuesForField(report, "orderDate")
                            : []
                        }
                        editing={isEditing("orderDate")}
                        onStartEdit={() =>
                          startEdit(result.email.id, "orderDate")
                        }
                        onCommit={(v) =>
                          commitEdit(result.email.id, "orderDate", v)
                        }
                        onCancel={cancelEdit}
                        className="whitespace-nowrap"
                      />

                      {/* 注文番号 */}
                      <EditableCell
                        value={order.orderNumber}
                        issues={
                          report
                            ? getIssuesForField(report, "orderNumber")
                            : []
                        }
                        editing={isEditing("orderNumber")}
                        onStartEdit={() =>
                          startEdit(result.email.id, "orderNumber")
                        }
                        onCommit={(v) =>
                          commitEdit(result.email.id, "orderNumber", v)
                        }
                        onCancel={cancelEdit}
                        className="whitespace-nowrap font-mono text-xs"
                      />

                      {/* 商品名 */}
                      <EditableCell
                        value={item.name}
                        issues={
                          report
                            ? getIssuesForField(
                                report,
                                `items[${idx}].name`
                              )
                            : []
                        }
                        editing={isEditing("itemName", idx)}
                        onStartEdit={() =>
                          startEdit(result.email.id, "itemName", idx)
                        }
                        onCommit={(v) =>
                          commitEdit(result.email.id, "itemName", v, idx)
                        }
                        onCancel={cancelEdit}
                      />

                      {/* 数量 */}
                      <EditableCell
                        value={String(item.quantity)}
                        issues={
                          report
                            ? getIssuesForField(
                                report,
                                `items[${idx}].quantity`
                              )
                            : []
                        }
                        editing={isEditing("itemQuantity", idx)}
                        onStartEdit={() =>
                          startEdit(result.email.id, "itemQuantity", idx)
                        }
                        onCommit={(v) =>
                          commitEdit(
                            result.email.id,
                            "itemQuantity",
                            v,
                            idx
                          )
                        }
                        onCancel={cancelEdit}
                        className="text-right"
                        inputType="number"
                      />

                      {/* 金額 */}
                      <EditableCell
                        value={String(item.price)}
                        issues={
                          report
                            ? getIssuesForField(
                                report,
                                `items[${idx}].price`
                              )
                            : []
                        }
                        editing={isEditing("itemPrice", idx)}
                        onStartEdit={() =>
                          startEdit(result.email.id, "itemPrice", idx)
                        }
                        onCommit={(v) =>
                          commitEdit(
                            result.email.id,
                            "itemPrice",
                            v,
                            idx
                          )
                        }
                        onCancel={cancelEdit}
                        className="whitespace-nowrap text-right"
                        inputType="number"
                      />

                      {/* 消費税 */}
                      <EditableCell
                        value={String(order.tax)}
                        issues={
                          report ? getIssuesForField(report, "tax") : []
                        }
                        editing={isEditing("tax")}
                        onStartEdit={() =>
                          startEdit(result.email.id, "tax")
                        }
                        onCommit={(v) =>
                          commitEdit(result.email.id, "tax", v)
                        }
                        onCancel={cancelEdit}
                        className="whitespace-nowrap text-right"
                        inputType="number"
                      />

                      {/* 合計 */}
                      <EditableCell
                        value={String(order.totalAmount)}
                        issues={
                          report
                            ? getIssuesForField(report, "totalAmount")
                            : []
                        }
                        editing={isEditing("totalAmount")}
                        onStartEdit={() =>
                          startEdit(result.email.id, "totalAmount")
                        }
                        onCommit={(v) =>
                          commitEdit(result.email.id, "totalAmount", v)
                        }
                        onCancel={cancelEdit}
                        className="whitespace-nowrap text-right"
                        inputType="number"
                      />

                      {/* 領収書リンク */}
                      <td className="px-4 py-2">
                        <a
                          href={
                            order.receiptUrl ||
                            `https://www.amazon.co.jp/gp/your-account/order-details?orderID=${order.orderNumber}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          開く
                        </a>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 問題一覧（詳細） */}
      {(totalErrors > 0 || totalWarnings > 0) && (
        <details className="rounded-lg border border-gray-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            バリデーション詳細（{totalErrors + totalWarnings}件）
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {Array.from(validationMap.entries()).flatMap(
              ([emailId, report]) =>
                report.issues.map((issue, idx) => (
                  <li
                    key={`${emailId}-${idx}`}
                    className={`rounded px-2 py-1 ${
                      issue.severity === "error"
                        ? "bg-red-50 text-red-700"
                        : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    <span className="font-mono">{issue.field}</span>:{" "}
                    {issue.message}
                  </li>
                ))
            )}
          </ul>
        </details>
      )}

      {/* 確認ボタン */}
      {successResults.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          {confirmed && (
            <span className="text-sm text-green-700">
              確認済み
            </span>
          )}
          <button
            onClick={handleConfirm}
            disabled={!overallValid && totalErrors > 0}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              confirmed
                ? "bg-green-600 hover:bg-green-700"
                : "bg-blue-600 hover:bg-blue-700"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {confirmed ? "再確認" : "データを確認"}
          </button>
        </div>
      )}
    </div>
  );
}
