#!/bin/bash

# Snapshot 问题诊断脚本

echo "========================================="
echo "🔍 Snapshot 问题诊断"
echo "========================================="
echo ""

# 测试区块范围
START_BLOCK=335107
END_BLOCK=335156

echo "📋 测试区块范围: $START_BLOCK - $END_BLOCK"
echo ""

# 检查 Node.js 进程
echo "1️⃣  检查 PM2 进程状态"
echo "-----------------------------------"
pm2 list | grep -E "start_snapshot|SolanaBl"
echo ""

# 检查日志中的错误
echo "2️⃣  检查最近的错误日志"
echo "-----------------------------------"
pm2 logs start_snapshot --lines 20 --nostream 2>/dev/null | grep -i "error\|failed" || echo "   无明显错误"
echo ""

# 创建测试脚本
echo "3️⃣  创建 ClickHouse 测试查询"
echo "-----------------------------------"

cat > /tmp/test-clickhouse-query.js << 'EOF'
const { createClient } = require('@clickhouse/client');
require('dotenv').config();

async function testQuery() {
    const client = createClient({
        host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
        database: process.env.CLICKHOUSE_DATABASE || 'default'
    });

    try {
        console.log('连接配置:');
        console.log('  Host:', process.env.CLICKHOUSE_HOST);
        console.log('  Database:', process.env.CLICKHOUSE_DATABASE);
        console.log('');

        // 测试连接
        const pingResult = await client.ping();
        console.log('✅ ClickHouse 连接成功:', pingResult.success);

        // 查询指定区块范围的数据
        const startBlock = 335107;
        const endBlock = 335156;
        
        console.log(`\n查询区块范围: ${startBlock} - ${endBlock}`);
        
        const query = `
            SELECT 
                COUNT(*) as total_count,
                MIN(block_height) as min_block,
                MAX(block_height) as max_block,
                MIN(transaction_time) as min_time,
                MAX(transaction_time) as max_time
            FROM solana_swap_transactions_token
            WHERE block_height >= ${startBlock}
              AND block_height <= ${endBlock}
        `;

        const result = await client.query({
            query,
            format: 'JSONEachRow'
        });

        const rows = await result.json();
        console.log('\n📊 查询结果:');
        console.log(JSON.stringify(rows, null, 2));

        // 如果有数据，查询详细信息
        if (rows.length > 0 && rows[0].total_count > 0) {
            console.log(`\n✅ 找到 ${rows[0].total_count} 条交易记录`);
            
            // 查询部分详细数据
            const detailQuery = `
                SELECT *
                FROM solana_swap_transactions_token
                WHERE block_height >= ${startBlock}
                  AND block_height <= ${endBlock}
                ORDER BY block_height ASC
                LIMIT 5
            `;
            
            const detailResult = await client.query({
                query: detailQuery,
                format: 'JSONEachRow'
            });
            
            const detailRows = await detailResult.json();
            console.log('\n📝 前5条记录样本:');
            console.log(JSON.stringify(detailRows.slice(0, 2), null, 2));
        } else {
            console.log('\n⚠️  该区块范围内没有交易数据');
            console.log('\n可能原因:');
            console.log('1. 该区块范围还未被扫描和写入');
            console.log('2. ClickHouse 数据同步延迟');
            console.log('3. 数据被清理或迁移');
            
            // 查询最新的区块高度
            const latestQuery = `
                SELECT 
                    MAX(block_height) as latest_block,
                    MAX(transaction_time) as latest_time,
                    COUNT(*) as total_records
                FROM solana_swap_transactions_token
            `;
            
            const latestResult = await client.query({
                query: latestQuery,
                format: 'JSONEachRow'
            });
            
            const latestRows = await latestResult.json();
            console.log('\n📈 数据库状态:');
            console.log(JSON.stringify(latestRows, null, 2));
        }

    } catch (error) {
        console.error('❌ 查询失败:', error.message);
        console.error('\n详细错误:');
        console.error(error);
    } finally {
        await client.close();
    }
}

testQuery();
EOF

echo "   ✅ 测试脚本已创建"
echo ""

echo "4️⃣  执行 ClickHouse 查询测试"
echo "-----------------------------------"
cd /home/ecs-user/data/git/solana-scan-node-new
node /tmp/test-clickhouse-query.js
echo ""

echo "========================================="
echo "💡 诊断建议"
echo "========================================="
echo ""
echo "根据上面的结果:"
echo ""
echo "如果显示 '该区块范围内没有交易数据':"
echo "  → 问题: 区块数据还未写入 ClickHouse"
echo "  → 原因: 可能是生产者/消费者未运行，或区块太旧已被清理"
echo "  → 解决: 检查 pm2 list，确保 scanner 和 consumer 正在运行"
echo ""
echo "如果显示连接错误:"
echo "  → 问题: ClickHouse 连接配置错误"
echo "  → 原因: .env 配置不正确或 ClickHouse 服务不可用"
echo "  → 解决: 检查 .env 文件中的 ClickHouse 配置"
echo ""
echo "如果显示有数据但 snapshot 失败:"
echo "  → 问题: PostgreSQL 连接或写入失败"
echo "  → 原因: PostgreSQL 密码错误或表不存在"
echo "  → 解决: 检查 PostgreSQL 配置和迁移状态"
echo ""
echo "========================================="
echo ""
echo "📝 后续操作:"
echo "1. 查看完整日志: pm2 logs start_snapshot --lines 100"
echo "2. 检查环境变量: cat .env | grep -E 'CLICKHOUSE|POSTGRES'"
echo "3. 重启 snapshot: pm2 restart start_snapshot"
echo ""








