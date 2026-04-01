-- 出金テーブルに会計カテゴリカラムを追加
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';
