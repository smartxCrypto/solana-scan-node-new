-- =============================================================================
-- 为 wallet_trading_ss_archive 表添加 block_height_range 字段
-- =============================================================================

-- 添加 block_height_range 字段
ALTER TABLE snapshot.wallet_trading_ss_archive 
ADD COLUMN IF NOT EXISTS block_height_range INT8RANGE;

-- 为 block_height_range 字段添加索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_wallet_trading_ss_archive_block_range 
ON snapshot.wallet_trading_ss_archive USING GIST (block_height_range);

-- 添加注释
COMMENT ON COLUMN snapshot.wallet_trading_ss_archive.block_height_range IS '快照区块高度范围';

-- 注意：如果表中已有数据，需要手动更新 block_height_range 的值
-- 例如：UPDATE snapshot.wallet_trading_ss_archive SET block_height_range = '[起始区块高度,结束区块高度)' WHERE block_height_range IS NULL;




