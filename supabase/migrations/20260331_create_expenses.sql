create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  payee_name text not null,
  description text not null default '',
  amount integer not null,
  notes text not null default '',
  photo_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 月別フィルタ用インデックス
create index if not exists idx_expenses_date on expenses (date);

-- updated_at 自動更新トリガー（関数は incomes マイグレーションで作成済み）
create trigger set_expenses_updated_at
  before update on expenses
  for each row
  execute function update_updated_at_column();
