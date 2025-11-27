// Snapshot 问题诊断脚本 - TypeScript 版本
// 运行: npx tsx scripts/diagnose-snapshot.ts

import clickhouseClient from '../src/constant/config/clickhouse';
import { SolanaBlockDataHandler } from '../src/service/SolanaBlockDataHandler';

async function diagnoseSnapshot() {
    console.log('=========================================');
    console.log('🔍 Snapshot 数据查询诊断');
    console.log('=========================================\n');

    const testBlocks = {
        start: 335107,
        end: 335156
    };

    console.log(`📋 测试区块范围: ${testBlocks.start} - ${testBlocks.end}\n`);

    try {
        // 1. 测试 ClickHouse 连接
        console.log('1️⃣  测试 ClickHouse 连接');
        console.log('-----------------------------------');
        const pingResult = await clickhouseClient.ping();
        console.log('✅ ClickHouse 连接成功:', pingResult.success);
        console.log('');

        // 2. 查询指定区块范围的数据统计
        console.log('2️⃣  查询指定区块范围的数据');
        console.log('-----------------------------------');
        const statsQuery = `
            SELECT 
                COUNT(*) as total_count,
                MIN(block_height) as min_block,
                MAX(block_height) as max_block,
                COUNT(DISTINCT token_address) as unique_tokens,
                COUNT(DISTINCT wallet_address) as unique_wallets
            FROM solana_swap_transactions_token
            WHERE block_height >= ${testBlocks.start}
              AND block_height <= ${testBlocks.end}
        `;

        const statsResult = await clickhouseClient.query({
            query: statsQuery,
            format: 'JSONEachRow'
        });

        const stats = await statsResult.json();
        console.log('查询结果:', JSON.stringify(stats, null, 2));

        if (stats[0] && stats[0].total_count > 0) {
            console.log(`\n✅ 找到 ${stats[0].total_count} 条交易记录`);
            console.log(`   - 唯一代币数: ${stats[0].unique_tokens}`);
            console.log(`   - 唯一钱包数: ${stats[0].unique_wallets}`);
        } else {
            console.log('\n⚠️  该区块范围内没有交易数据');
        }
        console.log('');

        // 3. 使用实际的服务方法查询
        console.log('3️⃣  使用 SolanaBlockDataHandler 查询');
        console.log('-----------------------------------');
        const txData = await SolanaBlockDataHandler.getDataByBlockHeightRange(
            testBlocks.start,
            testBlocks.end
        );
        console.log(`原始交易数据: ${txData.length} 条`);

        // 4. 过滤数据
        const filterData = SolanaBlockDataHandler.filterTokenData(txData);
        console.log(`过滤后交易数据: ${filterData.length} 条`);
        console.log('');

        // 5. 查询数据库最新状态
        console.log('4️⃣  查询 ClickHouse 最新数据状态');
        console.log('-----------------------------------');
        const latestQuery = `
            SELECT 
                MAX(block_height) as latest_block,
                MIN(block_height) as earliest_block,
                COUNT(*) as total_records,
                COUNT(DISTINCT token_address) as total_tokens
            FROM solana_swap_transactions_token
        `;

        const latestResult = await clickhouseClient.query({
            query: latestQuery,
            format: 'JSONEachRow'
        });

        const latestStats = await latestResult.json();
        console.log('数据库状态:', JSON.stringify(latestStats, null, 2));
        console.log('');

        // 6. 诊断结论
        console.log('=========================================');
        console.log('💡 诊断结论');
        console.log('=========================================');

        if (stats[0] && stats[0].total_count === 0) {
            console.log('\n🔴 问题确认: 指定区块范围内没有数据');
            console.log('\n可能原因:');
            console.log('  1. 该区块范围太旧，已被清理');
            console.log('  2. 该区块范围太新，还未被扫描和写入');
            console.log('  3. 扫描进程异常，未写入该区块数据');
            
            if (latestStats[0]) {
                const latestBlock = parseInt(latestStats[0].latest_block);
                const testStart = testBlocks.start;
                const testEnd = testBlocks.end;

                console.log('\n📊 数据库区块范围: ', latestStats[0].earliest_block, '-', latestBlock);
                console.log('   测试区块范围: ', testStart, '-', testEnd);

                if (testEnd < parseInt(latestStats[0].earliest_block)) {
                    console.log('\n⚠️  测试区块太旧，数据已被清理');
                    console.log('建议: 使用更新的区块范围进行测试');
                } else if (testStart > latestBlock) {
                    console.log('\n⚠️  测试区块太新，数据还未写入');
                    console.log('建议: 等待扫描进程处理，或使用已有数据的区块范围');
                } else {
                    console.log('\n⚠️  测试区块在数据范围内，但查询不到数据');
                    console.log('可能: 该区块范围内确实没有DEX交易');
                }
            }
        } else if (filterData.length === 0 && txData.length > 0) {
            console.log('\n🟡 问题确认: 有原始数据，但过滤后为空');
            console.log('\n可能原因:');
            console.log('  1. 交易不符合快照条件（金额太小、非DEX交易等）');
            console.log('  2. filterTokenData 过滤规则太严格');
            console.log(`\n详细: ${txData.length} 条原始数据 → ${filterData.length} 条过滤后数据`);
        } else if (filterData.length > 0) {
            console.log('\n✅ 数据查询正常！');
            console.log(`\n找到 ${filterData.length} 条符合快照条件的交易`);
            console.log('\n如果 snapshot 仍然失败，问题可能在:');
            console.log('  1. PostgreSQL 连接或写入失败');
            console.log('  2. snapshot 处理逻辑异常');
            console.log('  3. 数据格式转换问题');
        }

        console.log('\n=========================================');
        console.log('📝 建议的下一步操作');
        console.log('=========================================');
        console.log('\n1. 使用最新区块重新测试:');
        console.log(`   const latest = ${latestStats[0]?.latest_block || '382388000'};`);
        console.log('   测试范围: (latest - 100) 到 (latest - 50)');
        console.log('\n2. 检查 PostgreSQL 连接:');
        console.log('   pm2 logs start_snapshot --lines 50 | grep -i postgres');
        console.log('\n3. 检查快照数据写入:');
        console.log('   psql $DATABASE_URL -c "SELECT COUNT(*) FROM token_ss;"');
        console.log('\n=========================================\n');

    } catch (error) {
        console.error('\n❌ 诊断过程出错:', error);
        if (error instanceof Error) {
            console.error('错误详情:', error.message);
            console.error('堆栈:', error.stack);
        }
    } finally {
        await clickhouseClient.close();
    }
}

diagnoseSnapshot();








