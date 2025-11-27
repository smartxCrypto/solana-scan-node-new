import { readFileSync, writeFileSync } from "fs-extra";
import { getBlockTransactions } from "../collection/transactions/utils";
import { BlockDataSerializer } from "../lib/block-data-serializer";
import { BlockDataConverter } from "../lib/block-data-converter";
import { exportDexparserInstance } from "../collection/dex-parser";

describe('get block test', () => {
    test('should get block', async () => {
        const block = await getBlockTransactions(375235472);
        const serializedBlock = JSON.stringify(block, null, 2);
        writeFileSync('./src/__tests__/__test_value__/get_block.json', serializedBlock);
    });

    test('should parse the get block result', async () => {
        const blockData = readFileSync('./src/__tests__/__test_value__/get_block.json', 'utf-8');

        const blockDataObj = JSON.parse(blockData);
        const grpcData = BlockDataConverter.convertRpcToGrpc(blockDataObj);
        const parseResult = await exportDexparserInstance.parseBlockData(grpcData, 375235472);


        console.log("parseResult", parseResult.length);


        for (const tx of parseResult) {
            if (tx.trades.length === 0) {
                for (const trade of tx.trades) {
                    if (trade.signature.toLowerCase() === "fkeLoVt6zKBqx5K1oL9Y8zw8SF4FoSXFL1KNXkFHjntY1uiY5P7EobY1VCRWxzuXZLqTG2MoYjZrhjNF9BtQDUu".toLowerCase()) {
                        const tradeJson = JSON.stringify(trade, BlockDataSerializer.replacer, 2);
                        console.log("tradeJson", tradeJson);
                    }
                }
            }
        }

        const serializedParseResult = JSON.stringify(parseResult, BlockDataSerializer.replacer, 2);

        console.log("got parse result block data", serializedParseResult.length);

        writeFileSync('./src/__tests__/__test_result_value__/get_block_parse_result.json', serializedParseResult);
    });

    test('performance: measure complete parsing time', async () => {
        console.log('\n========================================');
        console.log('🔍 完整解析流程性能测试');
        console.log('========================================\n');

        const totalStart = performance.now();

        // 步骤 1: 读取区块数据
        const readStart = performance.now();
        const blockData = readFileSync('./src/__tests__/__test_value__/get_block.json', 'utf-8');
        const blockDataObj = JSON.parse(blockData);
        const readTime = performance.now() - readStart;
        console.log(`📖 步骤 1 - 读取区块数据: ${readTime.toFixed(2)} ms`);

        // 步骤 2: 转换格式 (RPC -> gRPC)
        const convertStart = performance.now();
        const grpcData = BlockDataConverter.convertRpcToGrpc(blockDataObj);
        const convertTime = performance.now() - convertStart;
        console.log(`🔄 步骤 2 - 格式转换: ${convertTime.toFixed(2)} ms`);

        // 步骤 3: 解析区块数据
        const parseStart = performance.now();
        const parseResult = await exportDexparserInstance.parseBlockData(grpcData, 382381926);
        const parseTime = performance.now() - parseStart;
        console.log(`⚙️  步骤 3 - 解析区块: ${parseTime.toFixed(2)} ms`);

        // 步骤 4: 统计解析结果
        const statsStart = performance.now();

        // 统计交易数据
        const totalTransactions = parseResult.length;
        const transactionsWithTrades = parseResult.filter(tx => tx.trades?.length > 0).length;
        const totalTrades = parseResult.reduce((sum, tx) => sum + (tx.trades?.length || 0), 0);

        // 统计 memeEvents
        const totalMemeEvents = parseResult.reduce((sum, tx) => sum + (tx.memeEvents?.length || 0), 0);
        const createEvents = parseResult.reduce((sum, tx) =>
            sum + (tx.memeEvents?.filter(e => e.type === 'CREATE').length || 0), 0);
        const migrateEvents = parseResult.reduce((sum, tx) =>
            sum + (tx.memeEvents?.filter(e => e.type === 'MIGRATE').length || 0), 0);

        // 统计 liquidities
        const totalLiquidities = parseResult.reduce((sum, tx) => sum + (tx.liquidities?.length || 0), 0);
        const poolCreateEvents = parseResult.reduce((sum, tx) =>
            sum + (tx.liquidities?.filter(l => l.type === 'CREATE').length || 0), 0);

        const statsTime = performance.now() - statsStart;
        console.log(`📊 步骤 4 - 统计结果: ${statsTime.toFixed(2)} ms`);

        // 步骤 5: 序列化结果
        const serializeStart = performance.now();
        const serializedResult = JSON.stringify(parseResult, BlockDataSerializer.replacer, 2);
        const dataSize = Buffer.byteLength(serializedResult, 'utf8');
        const serializeTime = performance.now() - serializeStart;
        console.log(`💾 步骤 5 - 序列化: ${serializeTime.toFixed(2)} ms`);

        // 总耗时
        const totalTime = performance.now() - totalStart;

        // 输出详细统计
        console.log('\n----------------------------------------');
        console.log('📈 解析结果统计:');
        console.log('----------------------------------------');
        console.log(`总交易数: ${totalTransactions}`);
        console.log(`包含交易的数量: ${transactionsWithTrades}`);
        console.log(`总 Trade 数: ${totalTrades}`);
        console.log(`\n🎯 MemeEvents 统计:`);
        console.log(`  - 总数: ${totalMemeEvents}`);
        console.log(`  - CREATE: ${createEvents}`);
        console.log(`  - MIGRATE: ${migrateEvents}`);
        console.log(`\n💧 Liquidities 统计:`);
        console.log(`  - 总数: ${totalLiquidities}`);
        console.log(`  - Pool CREATE: ${poolCreateEvents}`);
        console.log(`\n💾 数据大小:`);
        console.log(`  - 序列化后: ${(dataSize / 1024).toFixed(2)} KB`);
        console.log(`  - 平均每个交易: ${(dataSize / totalTransactions / 1024).toFixed(2)} KB`);

        // 性能汇总
        console.log('\n========================================');
        console.log('⏱️  性能汇总:');
        console.log('========================================');
        console.log(`读取数据:    ${readTime.toFixed(2).padStart(10)} ms  (${(readTime / totalTime * 100).toFixed(1)}%)`);
        console.log(`格式转换:    ${convertTime.toFixed(2).padStart(10)} ms  (${(convertTime / totalTime * 100).toFixed(1)}%)`);
        console.log(`解析区块:    ${parseTime.toFixed(2).padStart(10)} ms  (${(parseTime / totalTime * 100).toFixed(1)}%)`);
        console.log(`统计结果:    ${statsTime.toFixed(2).padStart(10)} ms  (${(statsTime / totalTime * 100).toFixed(1)}%)`);
        console.log(`序列化:      ${serializeTime.toFixed(2).padStart(10)} ms  (${(serializeTime / totalTime * 100).toFixed(1)}%)`);
        console.log('----------------------------------------');
        console.log(`总耗时:      ${totalTime.toFixed(2).padStart(10)} ms`);
        console.log('========================================');

        // 计算吞吐量
        console.log('\n📊 吞吐量估算:');
        console.log('----------------------------------------');
        const txPerSecond = (totalTransactions / totalTime * 1000).toFixed(2);
        const tradesPerSecond = (totalTrades / totalTime * 1000).toFixed(2);
        const blocksPerSecond = (1000 / totalTime).toFixed(2);
        console.log(`处理速度: ${txPerSecond} 交易/秒`);
        console.log(`Trade 速度: ${tradesPerSecond} trades/秒`);
        console.log(`区块处理速度: ${blocksPerSecond} 区块/秒`);

        // 性能建议
        console.log('\n💡 性能分析:');
        console.log('----------------------------------------');
        if (totalTime > 1000) {
            console.log('⚠️  解析耗时 > 1秒，建议优化解析逻辑');
        } else if (totalTime > 500) {
            console.log('⚠️  解析耗时 > 500ms，可能影响实时处理');
        } else {
            console.log('✅ 解析性能良好');
        }

        if (parseTime / totalTime > 0.8) {
            console.log('⚠️  解析步骤占比 > 80%，是主要瓶颈');
        }

        if (dataSize > 1024 * 1024) {
            console.log(`⚠️  数据大小 > 1MB (${(dataSize / 1024 / 1024).toFixed(2)} MB)，考虑压缩或精简`);
        }

        console.log('\n========================================\n');

        // 断言：确保解析成功
        expect(parseResult).toBeDefined();
        expect(parseResult.length).toBeGreaterThan(0);
        expect(totalTime).toBeLessThan(5000); // 期望总耗时 < 5秒
    }, 30000); // 设置 30 秒超时
});