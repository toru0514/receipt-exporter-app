-- 出金テーブル: photo_url (text) → photo_urls (jsonb配列) に変更
-- 既存データがあれば配列に変換して移行する

-- 新カラムを追加
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS photo_urls jsonb DEFAULT '[]'::jsonb;

-- 既存の photo_url データがあれば配列に変換
UPDATE expenses
SET photo_urls = jsonb_build_array(photo_url)
WHERE photo_url IS NOT NULL AND photo_url != '';

-- 旧カラムを削除
ALTER TABLE expenses DROP COLUMN IF EXISTS photo_url;
