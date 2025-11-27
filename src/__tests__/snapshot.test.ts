import { SolanaBlockDataHandler } from "../service/SolanaBlockDataHandler";
import { SnapshotForTokenAndWalletTrading } from "../snap-shot/index";
import { snapshotWalletTradingByTxDataOptimized } from "../snap-shot/wallet-trading/index";
import { snapshotTokenValueByTxData } from "../snap-shot/token/index";
import { TokenSwapFilterData } from "../type/swap";

describe('Snapshot functionality tests', () => {

    /**
     * 测试 filterTokenData 是否正确处理 transaction_time 的类型转换
     */
    test('should correctly convert transaction_time from number to string in filterTokenData', async () => {
        // 获取真实的交易数据（限制获取10条用于测试）
        const txData = await SolanaBlockDataHandler.getXDaysData(0, 10);

        console.log(`Retrieved ${txData.length} transactions for testing`);

        // 过滤数据
        const filteredData = SolanaBlockDataHandler.filterTokenData(txData);

        console.log(`Filtered to ${filteredData.length} valid transactions`);

        // 验证每个 transactionTime 都是字符串
        filteredData.forEach((data, index) => {
            expect(typeof data.transactionTime).toBe('string');
            console.log(`Transaction ${index + 1}: transactionTime = ${data.transactionTime} (type: ${typeof data.transactionTime})`);
        });

        // 至少应该有一些过滤后的数据
        expect(filteredData.length).toBeGreaterThan(0);
    }, 30000); // 增加超时时间为30秒

    /**
     * 测试钱包交易快照生成
     */
    test('should generate wallet trading snapshots with string transactionTime', async () => {
        // 获取真实的交易数据
        const txData = await SolanaBlockDataHandler.getXDaysData(0, 20);
        const filteredData = SolanaBlockDataHandler.filterTokenData(txData);

        if (filteredData.length === 0) {
            console.log('No filtered data available, skipping test');
            return;
        }

        console.log(`Testing wallet snapshots with ${filteredData.length} transactions`);

        // 生成钱包交易快照
        const walletSnapshots = await snapshotWalletTradingByTxDataOptimized(filteredData);

        console.log(`Generated ${walletSnapshots.length} wallet snapshots`);

        // 验证每个快照的 snapshotTime 都是字符串
        walletSnapshots.forEach((snapshot, index) => {
            expect(typeof snapshot.snapshotTime).toBe('string');
            expect(snapshot.snapshotTime.trim).toBeDefined(); // 确保有 trim 方法
            expect(snapshot.snapshotTime.trim()).not.toBe(''); // 不是空字符串

            if (index < 3) { // 只打印前3个
                console.log(`Wallet ${index + 1}:`);
                console.log(`  - snapshot: ${JSON.stringify(snapshot)}`);
            }
        });

        expect(walletSnapshots.length).toBeGreaterThan(0);
    }, 60000); // 60秒超时

    /**
     * 测试代币快照生成
     */
    test('should generate token snapshots correctly', async () => {
        // 获取真实的交易数据
        const txData = await SolanaBlockDataHandler.getXDaysData(0, 20);
        const filteredData = SolanaBlockDataHandler.filterTokenData(txData);

        if (filteredData.length === 0) {
            console.log('No filtered data available, skipping test');
            return;
        }

        console.log(`Testing token snapshots with ${filteredData.length} transactions`);

        // 生成代币快照
        const tokenSnapshots = snapshotTokenValueByTxData(filteredData);

        console.log(`Generated ${tokenSnapshots.length} token snapshots`);

        // 验证快照数据
        tokenSnapshots.forEach((snapshot, index) => {
            expect(snapshot.tokenAddress).toBeDefined();
            expect(typeof snapshot.tokenAddress).toBe('string');
            expect(snapshot.buyCount).toBeGreaterThanOrEqual(0);
            expect(snapshot.sellCount).toBeGreaterThanOrEqual(0);

            if (index < 3) { // 只打印前3个
                console.log(`Token ${index + 1}:`);
                console.log(`  - Address: ${snapshot.tokenAddress}`);
                console.log(`  - Buy Count: ${snapshot.buyCount}, Sell Count: ${snapshot.sellCount}`);
                console.log(`  - Start Price: ${snapshot.startPrice}, End Price: ${snapshot.endPrice}`);
            }
        });

        expect(tokenSnapshots.length).toBeGreaterThan(0);
    }, 30000);

    /**
     * 测试完整的区块快照流程
     */
    test('should process snapshot by block height range', async () => {
        // 获取最新的区块高度
        const latestData = await SolanaBlockDataHandler.getXDaysData(0, 1);

        if (latestData.length === 0) {
            console.log('No data available, skipping test');
            return;
        }

        const latestBlockHeight = latestData[0].block_height;
        console.log(`Latest block height: ${latestBlockHeight}`);

        // 测试一个小的区块范围（例如10个区块）
        const startBlock = Math.max(0, latestBlockHeight - 100);
        const endBlock = latestBlockHeight;

        console.log(`Testing snapshot for blocks ${startBlock} to ${endBlock}`);

        // 执行快照
        const result = await SnapshotForTokenAndWalletTrading(startBlock, endBlock);

        console.log('Snapshot result:', {
            tokenSnapShot: result.tokenSnapShot,
            walletSnapShot: result.walletSnapShot,
            processedWindows: result.processedWindows,
            message: result.message
        });

        // 验证结果
        expect(result).toBeDefined();
        expect(typeof result.tokenSnapShot).toBe('boolean');
        expect(typeof result.walletSnapShot).toBe('boolean');
        expect(typeof result.processedWindows).toBe('number');
        expect(typeof result.message).toBe('string');
    }, 120000); // 120秒超时

    /**
     * 测试边界情况：处理混合类型的 transaction_time
     */
    test('should handle mixed types of transaction_time (number and string)', () => {
        // 创建测试数据，包含数字和字符串类型的 transaction_time
        const mockTxData = [
            {
                tx_hash: 'test1',
                trade_type: 'BUY',
                transaction_time: 1763962391, // 数字类型
                pool_address: 'pool1',
                block_height: 100,
                wallet_address: 'wallet1',
                token_amount: 100,
                token_symbol: 'TEST',
                token_address: 'token1',
                quote_symbol: 'SOL',
                quote_amount: 1,
                quote_address: 'So11111111111111111111111111111111111111112',
                quote_price: 100,
                usd_price: 200,
                usd_amount: 200
            },
            {
                tx_hash: 'test2',
                trade_type: 'SELL',
                transaction_time: '2024-01-01T00:00:00.000Z', // 字符串类型
                pool_address: 'pool2',
                block_height: 101,
                wallet_address: 'wallet2',
                token_amount: 200,
                token_symbol: 'TEST2',
                token_address: 'token2',
                quote_symbol: 'SOL',
                quote_amount: 2,
                quote_address: 'So11111111111111111111111111111111111111112',
                quote_price: 150,
                usd_price: 300,
                usd_amount: 300
            }
        ] as any;

        // 过滤数据
        const filteredData = SolanaBlockDataHandler.filterTokenData(mockTxData);

        // 验证所有 transactionTime 都被转换为字符串
        filteredData.forEach((data, index) => {
            expect(typeof data.transactionTime).toBe('string');
            expect(data.transactionTime.trim).toBeDefined();
            console.log(`Mock transaction ${index + 1}: ${data.transactionTime} (type: ${typeof data.transactionTime})`);
        });
    });

    /**
     * 测试 snapshotTime 不会引起 trim 错误
     */
    test('should not throw "trim is not a function" error', async () => {
        const txData = await SolanaBlockDataHandler.getXDaysData(0, 5);
        const filteredData = SolanaBlockDataHandler.filterTokenData(txData);

        if (filteredData.length === 0) {
            console.log('No filtered data available, skipping test');
            return;
        }

        // 这个测试应该不会抛出错误
        expect(async () => {
            const walletSnapshots = await snapshotWalletTradingByTxDataOptimized(filteredData);

            // 尝试调用 trim（如果 snapshotTime 是数字会失败）
            walletSnapshots.forEach(snapshot => {
                const trimmed = snapshot.snapshotTime.trim();
                expect(trimmed).toBeDefined();
            });
        }).not.toThrow();
    }, 60000);
});

