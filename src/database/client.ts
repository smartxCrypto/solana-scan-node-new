import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

// 验证必需的环境变量
function getRequiredEnv(key: string, defaultValue?: string): string {
    const value = process.env[key] || defaultValue;
    if (!value) {
        console.error(`❌ 缺少必需的环境变量: ${key}`);
        console.error(`请在 .env 文件中配置: ${key}=your_value`);
    }
    return value || '';
}

// 创建 PostgreSQL 连接池
const pool = new Pool({
    host: getRequiredEnv('POSTGRES_HOST', 'localhost'),
    port: parseInt(getRequiredEnv('POSTGRES_PORT', '5432')),
    user: getRequiredEnv('POSTGRES_USER', 'postgres'),
    password: getRequiredEnv('POSTGRES_PASSWORD', ''),
    database: getRequiredEnv('POSTGRES_DATABASE', 'solana_scan'),
    max: 20, // 最大连接数
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// 创建 Drizzle 实例
export const db = drizzle(pool, { schema });

// 测试连接
export async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ PostgreSQL 连接成功');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ PostgreSQL 连接失败:', error);
        return false;
    }
}

// 优雅关闭
export async function closeConnection() {
    await pool.end();
    console.log('PostgreSQL 连接池已关闭');
}

// 导出 pool 以便在需要时使用原生查询
export { pool };

