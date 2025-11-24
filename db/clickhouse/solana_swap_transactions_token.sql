-- solana_swap_transactions_token 表建表 SQL
-- 主索引：token_address
-- 次级索引：transaction_time
-- 根据 SolanaBlockDataHandler.ts 中的查询模式优化索引

CREATE TABLE IF NOT EXISTS solana_swap_transactions_token
(
    tx_hash String,
    transaction_time UInt64,
    wallet_address String,
    token_amount Float64,
    token_symbol String,
    token_address String,
    quote_symbol String,
    quote_amount Float64,
    quote_address String,
    quote_price Float64,
    usd_price Float64,
    usd_amount Float64,
    trade_type String,
    block_height UInt64,
    pool_address String
)
ENGINE = MergeTree()
ORDER BY (token_address, transaction_time)
PARTITION BY toYYYYMM(toDateTime(transaction_time))
SETTINGS index_granularity = 8192;

-- 创建索引以优化常见查询模式

-- 1. 时间范围查询索引（用于按时间范围查询）
ALTER TABLE solana_swap_transactions_token ADD INDEX idx_transaction_time (transaction_time) TYPE minmax GRANULARITY 4;

-- 2. 区块高度索引（用于按区块高度范围查询）
ALTER TABLE solana_swap_transactions_token ADD INDEX idx_block_height (block_height) TYPE minmax GRANULARITY 4;

-- 3. 钱包地址索引（用于按钱包地址查询）
ALTER TABLE solana_swap_transactions_token ADD INDEX idx_wallet_address (wallet_address) TYPE bloom_filter GRANULARITY 4;

-- 4. 交易类型索引（用于按交易类型过滤）
ALTER TABLE solana_swap_transactions_token ADD INDEX idx_trade_type (trade_type) TYPE set(100) GRANULARITY 4;

-- 5. 池地址索引（用于按池地址查询）
ALTER TABLE solana_swap_transactions_token ADD INDEX idx_pool_address (pool_address) TYPE bloom_filter GRANULARITY 4;

-- 6. 复合索引：token_address + trade_type（用于按代币和交易类型查询）
ALTER TABLE solana_swap_transactions_token ADD INDEX idx_token_trade_type (token_address, trade_type) TYPE bloom_filter GRANULARITY 4;

-- 7. 复合索引：token_address + transaction_time（用于按代币和时间排序查询）
-- 注意：这个索引已经通过 ORDER BY (token_address, transaction_time) 隐式创建，但可以添加额外的索引优化特定查询

-- 8. 复合索引：wallet_address + transaction_time（用于按钱包和时间查询）
ALTER TABLE solana_swap_transactions_token ADD INDEX idx_wallet_time (wallet_address, transaction_time) TYPE minmax GRANULARITY 4;

-- 9. 复合索引：block_height + transaction_time（用于按区块高度和时间查询）
ALTER TABLE solana_swap_transactions_token ADD INDEX idx_block_time (block_height, transaction_time) TYPE minmax GRANULARITY 4;

-- 10. USD价格索引（用于价格相关查询）
ALTER TABLE solana_swap_transactions_token ADD INDEX idx_usd_price (usd_price) TYPE minmax GRANULARITY 4;

