import { createClient } from "microcms-js-sdk";
import type { Receipt, ReceiptCreateInput, ReceiptSource } from "./receipt-types";
import type { ParsedOrder } from "./types";
import { getDefaultReceiptUrl } from "./receipt-url";

function getClient() {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = process.env.MICROCMS_API_KEY;

  if (!serviceDomain || !apiKey) {
    throw new Error(
      "MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY を環境変数に設定してください"
    );
  }

  return createClient({ serviceDomain, apiKey });
}

interface MicroCMSReceiptResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  image?: { url: string };
  date?: string;
  storeName?: string;
  totalAmount?: number;
  tax?: number;
  items?: string;
  paymentMethod?: string;
  category?: string;
  memo?: string;
  analyzedAt?: string;
  source?: string;
  orderNumber?: string;
  receiptUrl?: string;
}

function toReceipt(item: MicroCMSReceiptResponse): Receipt {
  let items = [];
  try {
    items = item.items ? JSON.parse(item.items) : [];
  } catch {
    items = [];
  }

  return {
    id: item.id,
    imageUrl: item.image?.url ?? "",
    date: item.date ?? "",
    storeName: item.storeName ?? "",
    totalAmount: item.totalAmount ?? 0,
    tax: item.tax ?? 0,
    items,
    paymentMethod: item.paymentMethod ?? "",
    category: item.category ?? "",
    memo: item.memo ?? "",
    analyzedAt: item.analyzedAt ?? "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    source: (item.source as ReceiptSource) ?? "photo",
    orderNumber: item.orderNumber ?? "",
    receiptUrl: item.receiptUrl ?? "",
  };
}

/** 領収書一覧を取得（月別・ソースフィルタ対応） */
export async function getReceipts(params?: {
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
  source?: ReceiptSource;
}): Promise<{ receipts: Receipt[]; totalCount: number }> {
  const client = getClient();
  const limit = params?.limit ?? 100;
  const offset = params?.offset ?? 0;

  const filters: string[] = [];
  if (params?.year && params?.month) {
    const startDate = `${params.year}-${String(params.month).padStart(2, "0")}-01`;
    const endMonth = params.month === 12 ? 1 : params.month + 1;
    const endYear = params.month === 12 ? params.year + 1 : params.year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    filters.push(`date[greater_equal]${startDate}`);
    filters.push(`date[less_than]${endDate}`);
  } else if (params?.year) {
    filters.push(`date[greater_equal]${params.year}-01-01`);
    filters.push(`date[less_than]${params.year + 1}-01-01`);
  }
  if (params?.source) {
    filters.push(`source[equals]${params.source}`);
  }

  const response = await client.getList<MicroCMSReceiptResponse>({
    endpoint: "receipts",
    queries: {
      limit,
      offset,
      orders: "-date",
      ...(filters.length > 0 ? { filters: filters.join("[and]") } : {}),
    },
  });

  return {
    receipts: response.contents.map(toReceipt),
    totalCount: response.totalCount,
  };
}

/** 領収書を1件取得 */
export async function getReceipt(id: string): Promise<Receipt> {
  const client = getClient();
  const item = await client.get<MicroCMSReceiptResponse>({
    endpoint: "receipts",
    contentId: id,
  });
  return toReceipt(item);
}

/** 画像をmicroCMSメディアにアップロードし、URLを返す */
async function uploadImage(base64DataUrl: string): Promise<string> {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN!;
  const apiKey = process.env.MICROCMS_API_KEY!;

  // base64 data URLからBlobに変換
  const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error("無効な画像データです");
  }
  const contentType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  const ext = contentType.includes("png") ? "png" : "jpg";
  const fileName = `receipt_${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: contentType }), fileName);

  const response = await fetch(
    `https://${serviceDomain}.microcms-management.io/api/v1/media`,
    {
      method: "POST",
      headers: {
        "X-MICROCMS-API-KEY": apiKey,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`画像アップロードに失敗しました: ${errorText}`);
  }

  const data = await response.json();
  return data.url;
}

/** 領収書を新規作成 */
export async function createReceipt(
  input: ReceiptCreateInput
): Promise<Receipt> {
  const client = getClient();

  // 既存のmicroCMS URLがあればそのまま使用、なければアップロード
  let imageUrl = "";
  if (input.imageUrl) {
    imageUrl = input.imageUrl;
  } else if (input.image) {
    imageUrl = await uploadImage(input.image);
  }

  const content: Record<string, unknown> = {
    date: input.date,
    storeName: input.storeName,
    totalAmount: input.totalAmount,
    tax: input.tax,
    items: JSON.stringify(input.items),
    paymentMethod: input.paymentMethod,
    category: input.category,
    memo: input.memo,
    analyzedAt: input.analyzedAt,
    source: input.source,
    orderNumber: input.orderNumber ?? "",
    receiptUrl: input.receiptUrl ?? "",
  };
  if (imageUrl) {
    content.image = imageUrl;
  }

  const response = await client.create<MicroCMSReceiptResponse>({
    endpoint: "receipts",
    content: content as unknown as MicroCMSReceiptResponse,
  });

  return {
    id: response.id,
    imageUrl,
    date: input.date,
    storeName: input.storeName,
    totalAmount: input.totalAmount,
    tax: input.tax,
    items: input.items,
    paymentMethod: input.paymentMethod,
    category: input.category,
    memo: input.memo,
    analyzedAt: input.analyzedAt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: input.source,
    orderNumber: input.orderNumber ?? "",
    receiptUrl: input.receiptUrl ?? "",
  };
}

/** 注文番号で既存レシートを検索（重複チェック用） */
export async function findReceiptByOrderNumber(
  orderNumber: string
): Promise<Receipt | null> {
  const client = getClient();
  const response = await client.getList<MicroCMSReceiptResponse>({
    endpoint: "receipts",
    queries: {
      filters: `orderNumber[equals]${orderNumber}`,
      limit: 1,
    },
  });
  if (response.contents.length === 0) return null;
  return toReceipt(response.contents[0]);
}

/** ParsedOrder から Receipt を作成してmicroCMSに保存 */
export async function createReceiptFromOrder(
  order: ParsedOrder
): Promise<Receipt> {
  const storeName = order.source === "amazon" ? "Amazon" : "楽天市場";
  const receiptUrl =
    order.receiptUrl || getDefaultReceiptUrl(order.source, order.orderNumber);

  return createReceipt({
    date: order.orderDate,
    storeName,
    totalAmount: order.totalAmount,
    tax: order.tax,
    items: order.items,
    paymentMethod: "",
    category: "",
    memo: "",
    analyzedAt: new Date().toISOString(),
    source: order.source,
    orderNumber: order.orderNumber,
    receiptUrl,
  });
}

/** 領収書を削除 */
export async function deleteReceipt(id: string): Promise<void> {
  const client = getClient();
  await client.delete({
    endpoint: "receipts",
    contentId: id,
  });
}

