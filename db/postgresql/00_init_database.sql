-- =============================================================================
-- PostgreSQL 数据库初始化脚本
-- 适用于 Solana Scan Node 项目
-- =============================================================================

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 创建 Schema
CREATE SCHEMA IF NOT EXISTS snapshot;

-- 授予权限
GRANT USAGE ON SCHEMA snapshot TO CURRENT_USER;
GRANT CREATE ON SCHEMA snapshot TO CURRENT_USER;

-- 设置搜索路径
SET search_path TO public, snapshot;

-- 创建自定义类型
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_type_enum') THEN
        CREATE TYPE trade_type_enum AS ENUM ('BUY', 'SELL');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'snapshot_type_enum') THEN
        CREATE TYPE snapshot_type_enum AS ENUM ('TokenNormSnapShot', 'SnapShotForWalletTrading');
    END IF;
END $$;
