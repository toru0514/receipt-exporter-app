-- RLS を有効化
alter table incomes enable row level security;

-- 認証済みユーザーのみ全操作を許可するポリシー
create policy "Allow authenticated access" on incomes
  for all
  to authenticated
  using (true)
  with check (true);
