create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  client_name text not null,
  description text not null default '',
  amount integer not null,
  notes text not null default '',
  photo_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 月別フィルタ用インデックス
create index if not exists idx_incomes_date on incomes (date);

-- updated_at 自動更新トリガー
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_incomes_updated_at
  before update on incomes
  for each row
  execute function update_updated_at_column();
