-- =============================================================================
-- 主要业务表创建脚本
-- =============================================================================

-- 创建更新触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. tokens 表 - 代币基础信息表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(255),
    logo_url VARCHAR(512),
    website_url VARCHAR(512),
    twitter_url VARCHAR(512),
    telegram_url VARCHAR(512),
    token_address VARCHAR(50) NOT NULL UNIQUE,
    decimals INTEGER NOT NULL,
    is_risk_token BOOLEAN DEFAULT FALSE,
    total_supply NUMERIC(30, 8) NOT NULL,
    first_seen_timestamp BIGINT,
    meta_uri TEXT,
    token_create_ts BIGINT,
    sol_scan_image VARCHAR(255),
    latest_price NUMERIC(20, 12) DEFAULT 0.000000000000,
    latest_price_update_ts BIGINT,
    creator_address VARCHAR(255),
    create_tx VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tokens_token_address ON tokens (token_address);
CREATE INDEX idx_tokens_symbol ON tokens (symbol);
CREATE INDEX idx_tokens_is_risk ON tokens (is_risk_token);
CREATE INDEX idx_tokens_created_at ON tokens (created_at DESC);

CREATE TRIGGER update_tokens_updated_at
    BEFORE UPDATE ON tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. lp_info 表 - 流动性池信息表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lp_info (
    id SERIAL PRIMARY KEY,
    pool_address VARCHAR(50) NOT NULL UNIQUE,
    token_a_mint VARCHAR(128) NOT NULL,
    token_b_mint VARCHAR(128) NOT NULL,
    token_a_symbol VARCHAR(255) NOT NULL,
    token_b_symbol VARCHAR(255) NOT NULL,
    token_a_amount BIGINT NOT NULL,
    token_b_amount BIGINT NOT NULL,
    liquidity_usd BIGINT NOT NULL,
    fee_rate DOUBLE PRECISION NOT NULL,
    created_timestamp BIGINT NOT NULL,
    last_updated_timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lp_info_pool_address ON lp_info (pool_address);
CREATE INDEX idx_lp_info_token_a ON lp_info (token_a_mint);
CREATE INDEX idx_lp_info_token_b ON lp_info (token_b_mint);
CREATE INDEX idx_lp_info_pair ON lp_info (token_a_mint, token_b_mint);
CREATE INDEX idx_lp_info_updated ON lp_info (last_updated_timestamp DESC);

CREATE TRIGGER update_lp_info_updated_at
    BEFORE UPDATE ON lp_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. snapshot_info 表 - 快照信息元数据表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshot_info (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    type snapshot_type_enum NOT NULL,
    block_height BIGINT NOT NULL,
    block_time BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_snapshot_info_type ON snapshot_info (type);
CREATE INDEX idx_snapshot_info_timestamp ON snapshot_info (timestamp DESC);
CREATE INDEX idx_snapshot_info_block_height ON snapshot_info (block_height DESC);
CREATE INDEX idx_snapshot_info_type_timestamp ON snapshot_info (type, timestamp DESC);

CREATE TRIGGER update_snapshot_info_updated_at
    BEFORE UPDATE ON snapshot_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. smart_money_address 表 - 聪明钱地址表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS smart_money_address (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(255),
    confidence_score NUMERIC(5, 2) DEFAULT 0,
    total_pnl NUMERIC(30, 8) DEFAULT 0,
    win_rate NUMERIC(5, 2) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    first_seen_timestamp BIGINT,
    last_active_timestamp BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_smart_money_wallet_address ON smart_money_address (wallet_address);
CREATE INDEX idx_smart_money_is_active ON smart_money_address (is_active);
CREATE INDEX idx_smart_money_score ON smart_money_address (confidence_score DESC);
CREATE INDEX idx_smart_money_pnl ON smart_money_address (total_pnl DESC);
CREATE INDEX idx_smart_money_last_active ON smart_money_address (last_active_timestamp DESC);

CREATE TRIGGER update_smart_money_address_updated_at
    BEFORE UPDATE ON smart_money_address
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
