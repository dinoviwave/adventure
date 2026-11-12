-- sync_log 加入 detail 欄位（略過、對不上、警告、失敗項目的 JSON）。
-- 0001 是原始結構（沒有 detail），所以新建與既有的資料庫都走同一條升級路徑。
ALTER TABLE sync_log ADD COLUMN detail TEXT;
