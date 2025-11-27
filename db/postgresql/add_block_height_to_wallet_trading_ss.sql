-- =============================================================================
-- 为 wallet_trading_ss 表添加 block_height 字段
-- =============================================================================

-- 添加 block_height 字段
ALTER TABLE wallet_trading_ss 
ADD COLUMN IF NOT EXISTS block_height BIGINT;

-- 为 block_height 字段添加索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_wallet_trading_ss_block_height 
ON wallet_trading_ss (block_height DESC);

-- 添加注释
COMMENT ON COLUMN wallet_trading_ss.block_height IS '快照区块高度';




