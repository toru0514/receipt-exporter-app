create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  image_url text not null default '',
  date date not null,
  store_name text not null,
  total_amount integer not null,
  tax integer not null default 0,
  items jsonb not null default '[]',
  payment_method text not null default '',
  category text not null default '',
  memo text not null default '',
  analyzed_at timestamptz,
  source text not null default 'photo',
  order_number text not null default '',
  receipt_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 月別フィルタ用インデックス
create index if not exists idx_receipts_date on receipts (date);

-- 注文番号検索用インデックス
create index if not exists idx_receipts_order_number on receipts (order_number);

-- updated_at 自動更新トリガー（関数は incomes マイグレーションで作成済み）
create trigger set_receipts_updated_at
  before update on receipts
  for each row
  execute function update_updated_at_column();

-- RLS を有効化
alter table receipts enable row level security;

-- 認証済みユーザーのみ全操作を許可するポリシー
create policy "Allow authenticated access" on receipts
  for all
  to authenticated
  using (true)
  with check (true);
