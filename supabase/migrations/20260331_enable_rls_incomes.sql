-- RLS を有効化
alter table incomes enable row level security;

-- anon / authenticated ロールに全操作を許可するポリシー
create policy "Allow all access" on incomes
  for all
  using (true)
  with check (true);
