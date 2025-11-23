-- LP信息表索引创建SQL
-- 这些索引针对 lpInfo.ts 中的查询功能进行优化

-- 1. 主键索引（通常自动创建，这里只是为了完整性展示）
-- ALTER TABLE lp_info ADD PRIMARY KEY (id);

-- 2. 池地址唯一索引（用于根据池地址快速查询和确保池地址唯一性）
CREATE UNIQUE INDEX idx_lp_info_pool_address ON lp_info (pool_address);

-- 3. Token A 查询索引（用于根据 token_a_mint 查询）
CREATE INDEX idx_lp_info_token_a_mint ON lp_info (token_a_mint);

-- 4. Token B 查询索引（用于根据 token_b_mint 查询）
CREATE INDEX idx_lp_info_token_b_mint ON lp_info (token_b_mint);

-- 5. 复合索引：Token A + Token B（用于查询特定交易对）
CREATE INDEX idx_lp_info_token_pair ON lp_info (token_a_mint, token_b_mint);

-- 6. 复合索引：Token B + Token A（用于反向查询交易对）
CREATE INDEX idx_lp_info_token_pair_reverse ON lp_info (token_b_mint, token_a_mint);

-- 7. 流动性排序索引（用于按流动性排序查询）
CREATE INDEX idx_lp_info_liquidity_desc ON lp_info (liquidity_usd DESC);

-- 8. 时间戳索引（用于按最后更新时间排序）
CREATE INDEX idx_lp_info_last_updated ON lp_info (last_updated_timestamp DESC);

-- 9. 复合索引：流动性 + 最后更新时间（用于综合排序）
CREATE INDEX idx_lp_info_liquidity_time ON lp_info (liquidity_usd DESC, last_updated_timestamp DESC);

-- 10. Symbol 搜索索引（用于按符号搜索）
CREATE INDEX idx_lp_info_token_a_symbol ON lp_info (token_a_symbol);
CREATE INDEX idx_lp_info_token_b_symbol ON lp_info (token_b_symbol);

-- 11. 创建时间索引（用于按创建时间查询）
CREATE INDEX idx_lp_info_created_timestamp ON lp_info (created_timestamp DESC);

-- 12. 费率索引（用于按费率过滤）
CREATE INDEX idx_lp_info_fee_rate ON lp_info (fee_rate);

-- 13. 复合索引：流动性过滤 + 排序（用于分页查询）
CREATE INDEX idx_lp_info_liquidity_filter ON lp_info (liquidity_usd, last_updated_timestamp DESC);

-- 14. Token地址或符号搜索的复合索引（优化搜索功能）
-- 注意：这个索引较大，如果不经常使用可以考虑删除
CREATE INDEX idx_lp_info_search_tokens ON lp_info (token_a_mint, token_b_mint, token_a_symbol, token_b_symbol);

-- 执行索引分析以确保索引被正确使用
-- ANALYZE TABLE lp_info;

-- 查看索引使用情况的查询（用于监控和优化）
/*
-- 查看表的所有索引
SHOW INDEX FROM lp_info;

-- 查看索引使用统计
SELECT 
    OBJECT_SCHEMA,
    OBJECT_NAME,
    INDEX_NAME,
    COUNT_FETCH,
    COUNT_INSERT,
    COUNT_UPDATE,
    COUNT_DELETE
FROM performance_schema.table_io_waits_summary_by_index_usage 
WHERE OBJECT_SCHEMA = 'your_database_name' 
AND OBJECT_NAME = 'lp_info';
*/ 