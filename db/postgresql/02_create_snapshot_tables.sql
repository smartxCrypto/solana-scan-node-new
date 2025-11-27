-- =============================================================================
-- 快照表创建脚本
-- 注意：归档功能由应用程序代码实现
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. token_ss 表 - 代币快照详细数据（小周期，代码中使用的表名）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS token_ss (
    id BIGSERIAL PRIMARY KEY,
    block_height BIGINT NOT NULL,
    block_time TIMESTAMP NOT NULL,
    token_address VARCHAR(50) NOT NULL,
    buy_amount NUMERIC(30, 8) DEFAULT 0,
    sell_amount NUMERIC(30, 8) DEFAULT 0,
    buy_count INTEGER DEFAULT 0,
    sell_count INTEGER DEFAULT 0,
    high_price NUMERIC(20, 12) DEFAULT 0,
    low_price NUMERIC(20, 12) DEFAULT 0,
    start_price NUMERIC(20, 12) DEFAULT 0,
    end_price NUMERIC(20, 12) DEFAULT 0,
    avg_price NUMERIC(20, 12) DEFAULT 0,
    pool_address VARCHAR(50),
    snap_shot_block_time BIGINT NOT NULL,
    total_supply NUMERIC(30, 8),
    token_symbol VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_ss_token_address ON token_ss (token_address);
CREATE INDEX idx_token_ss_block_height ON token_ss (block_height DESC);
CREATE INDEX idx_token_ss_block_time ON token_ss (block_time DESC);
CREATE INDEX idx_token_ss_created_at ON token_ss (created_at DESC);
CREATE INDEX idx_token_ss_token_time ON token_ss (token_address, created_at DESC);
CREATE INDEX idx_token_ss_pool ON token_ss (pool_address);

CREATE TRIGGER update_token_ss_updated_at
    BEFORE UPDATE ON token_ss
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. token_ss_archive 表 - 代币快照归档数据（大周期，50倍聚合）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshot.token_ss_archive (
    id BIGSERIAL PRIMARY KEY,
    block_height_range INT8RANGE NOT NULL,
    time_range TSRANGE NOT NULL,
    token_address VARCHAR(50) NOT NULL,
    buy_amount NUMERIC(30, 8) DEFAULT 0,
    sell_amount NUMERIC(30, 8) DEFAULT 0,
    buy_count INTEGER DEFAULT 0,
    sell_count INTEGER DEFAULT 0,
    high_price NUMERIC(20, 12) DEFAULT 0,
    low_price NUMERIC(20, 12) DEFAULT 0,
    start_price NUMERIC(20, 12) DEFAULT 0,
    end_price NUMERIC(20, 12) DEFAULT 0,
    avg_price NUMERIC(20, 12) DEFAULT 0,
    pool_address VARCHAR(50),
    aggregation_level INTEGER DEFAULT 50,
    total_supply NUMERIC(30, 8),
    token_symbol VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_ss_archive_token_address ON snapshot.token_ss_archive (token_address);
CREATE INDEX idx_token_ss_archive_created_at ON snapshot.token_ss_archive (created_at DESC);
CREATE INDEX idx_token_ss_archive_block_range ON snapshot.token_ss_archive USING GIST (block_height_range);
CREATE INDEX idx_token_ss_archive_time_range ON snapshot.token_ss_archive USING GIST (time_range);
CREATE INDEX idx_token_ss_archive_token_time ON snapshot.token_ss_archive (token_address, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. wallet_trading_ss 表 - 钱包交易快照详细数据（小周期，代码中使用的表名）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_trading_ss (
    id BIGSERIAL PRIMARY KEY,
    wallet_address VARCHAR(50) NOT NULL,
    snapshot_time TIMESTAMP NOT NULL,
    per_tl_trading_value JSONB DEFAULT '[]'::jsonb,
    total_buy_sol_amount NUMERIC(30, 8) DEFAULT 0,
    total_buy_usd_amount NUMERIC(30, 8) DEFAULT 0,
    total_sell_sol_amount NUMERIC(30, 8) DEFAULT 0,
    total_sell_usd_amount NUMERIC(30, 8) DEFAULT 0,
    buy_count INTEGER DEFAULT 0,
    sell_count INTEGER DEFAULT 0,
    sol_price NUMERIC(20, 12) DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    lose_count INTEGER DEFAULT 0,
    current_token_value JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_trading_ss_wallet_address ON wallet_trading_ss (wallet_address);
CREATE INDEX idx_wallet_trading_ss_snapshot_time ON wallet_trading_ss (snapshot_time DESC);
CREATE INDEX idx_wallet_trading_ss_created_at ON wallet_trading_ss (created_at DESC);
CREATE INDEX idx_wallet_trading_ss_wallet_time ON wallet_trading_ss (wallet_address, created_at DESC);
CREATE INDEX idx_wallet_trading_ss_per_tl_json ON wallet_trading_ss USING GIN (per_tl_trading_value);
CREATE INDEX idx_wallet_trading_ss_current_json ON wallet_trading_ss USING GIN (current_token_value);

CREATE TRIGGER update_wallet_trading_ss_updated_at
    BEFORE UPDATE ON wallet_trading_ss
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. wallet_trading_ss_archive 表 - 钱包交易快照归档数据（大周期，50倍聚合）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshot.wallet_trading_ss_archive (
    id BIGSERIAL PRIMARY KEY,
    wallet_address VARCHAR(50) NOT NULL,
    block_height_range INT8RANGE NOT NULL,
    time_range TSRANGE NOT NULL,
    per_tl_trading_value JSONB DEFAULT '[]'::jsonb,
    total_buy_sol_amount NUMERIC(30, 8) DEFAULT 0,
    total_buy_usd_amount NUMERIC(30, 8) DEFAULT 0,
    total_sell_sol_amount NUMERIC(30, 8) DEFAULT 0,
    total_sell_usd_amount NUMERIC(30, 8) DEFAULT 0,
    buy_count INTEGER DEFAULT 0,
    sell_count INTEGER DEFAULT 0,
    avg_sol_price NUMERIC(20, 12) DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    lose_count INTEGER DEFAULT 0,
    current_token_value JSONB DEFAULT '[]'::jsonb,
    aggregation_level INTEGER DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_trading_ss_archive_wallet_address ON snapshot.wallet_trading_ss_archive (wallet_address);
CREATE INDEX idx_wallet_trading_ss_archive_created_at ON snapshot.wallet_trading_ss_archive (created_at DESC);
CREATE INDEX idx_wallet_trading_ss_archive_block_range ON snapshot.wallet_trading_ss_archive USING GIST (block_height_range);
CREATE INDEX idx_wallet_trading_ss_archive_time_range ON snapshot.wallet_trading_ss_archive USING GIST (time_range);
CREATE INDEX idx_wallet_trading_ss_archive_wallet_time ON snapshot.wallet_trading_ss_archive (wallet_address, created_at DESC);
CREATE INDEX idx_wallet_trading_ss_archive_per_tl_json ON snapshot.wallet_trading_ss_archive USING GIN (per_tl_trading_value);
