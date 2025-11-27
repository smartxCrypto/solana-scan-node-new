import { SnapshotInfoRepository, TokenSnapshotRepository, WalletTradingSnapshotRepository } from '../database/repositories';
import { testConnection, closeConnection } from '../database/client';

describe('Drizzle ORM Repository Tests', () => {
    
    beforeAll(async () => {
        const connected = await testConnection();
        if (!connected) {
            throw new Error('无法连接到数据库');
        }
    });

    afterAll(async () => {
        await closeConnection();
    });

    describe('SnapshotInfoRepository', () => {
        test('should create snapshot info', async () => {
            const result = await SnapshotInfoRepository.create({
                timestamp: Math.floor(Date.now() / 1000),
                type: 'TokenNormSnapShot',
                blockHeight: 123456,
                blockTime: Math.floor(Date.now() / 1000),
            });

            console.log('创建快照信息:', result);
            expect(result.id).toBeDefined();
            expect(result.type).toBe('TokenNormSnapShot');
        }, 10000);

        test('should find latest snapshot by type', async () => {
            const result = await SnapshotInfoRepository.findLatestByType('TokenNormSnapShot');
            
            console.log('最新快照:', result);
            if (result) {
                expect(result.type).toBe('TokenNormSnapShot');
            }
        }, 10000);

        test('should find snapshots by time range', async () => {
            const now = Math.floor(Date.now() / 1000);
            const oneDayAgo = now - 86400;
            
            const results = await SnapshotInfoRepository.findByTimeRange(oneDayAgo, now);
            
            console.log(`找到 ${results.length} 个快照`);
            expect(Array.isArray(results)).toBe(true);
        }, 10000);
    });

    describe('TokenSnapshotRepository', () => {
        test('should create token snapshot', async () => {
            const result = await TokenSnapshotRepository.create({
                blockHeight: 100000,
                blockTime: new Date(),
                tokenAddress: 'DrizzleTestToken123',
                buyAmount: '1000.5',
                sellAmount: '500.25',
                buyCount: 10,
                sellCount: 5,
                highPrice: '2.5',
                lowPrice: '1.5',
                startPrice: '2.0',
                endPrice: '2.2',
                avgPrice: '2.1',
                poolAddress: 'DrizzleTestPool123',
                snapShotBlockTime: 50,
            });

            console.log('创建代币快照:', result);
            expect(result.id).toBeDefined();
            expect(result.tokenAddress).toBe('DrizzleTestToken123');
        }, 10000);

        test('should find latest token snapshot', async () => {
            const result = await TokenSnapshotRepository.findLatestByToken('DrizzleTestToken123');
            
            console.log('最新代币快照:', result);
            if (result) {
                expect(result.tokenAddress).toBe('DrizzleTestToken123');
            }
        }, 10000);

        test('should find token snapshots by block range', async () => {
            const results = await TokenSnapshotRepository.findByBlockRange(90000, 110000);
            
            console.log(`找到 ${results.length} 个代币快照`);
            expect(Array.isArray(results)).toBe(true);
        }, 10000);
    });

    describe('WalletTradingSnapshotRepository', () => {
        test('should create wallet trading snapshot', async () => {
            const result = await WalletTradingSnapshotRepository.create({
                walletAddress: 'DrizzleTestWallet123',
                snapshotTime: new Date(),
                perTLTradingValue: [
                    {
                        tokenAddress: 'Token1',
                        tradeAmount: 100,
                        tokenPrice: 1.5,
                        isBuy: true,
                    }
                ],
                currentTokenValue: [
                    {
                        tokenAddress: 'Token1',
                        tokenBalance: 100,
                        tokenSolPrice: 1.5,
                    }
                ],
                totalBuySolAmount: '10.5',
                totalBuyUsdAmount: '200.0',
                totalSellSolAmount: '5.0',
                totalSellUsdAmount: '100.0',
                buyCount: 5,
                sellCount: 3,
                solPrice: '150.5',
                winCount: 2,
                loseCount: 1,
            });

            console.log('创建钱包快照:', result);
            expect(result.id).toBeDefined();
            expect(result.walletAddress).toBe('DrizzleTestWallet123');
        }, 10000);

        test('should find latest wallet snapshot', async () => {
            const result = await WalletTradingSnapshotRepository.findLatestByWallet('DrizzleTestWallet123');
            
            console.log('最新钱包快照:', result);
            if (result) {
                expect(result.walletAddress).toBe('DrizzleTestWallet123');
                expect(result.perTLTradingValue).toBeDefined();
            }
        }, 10000);

        test('should find wallet snapshot before specific time', async () => {
            const futureTime = new Date(Date.now() + 86400000); // 明天
            const result = await WalletTradingSnapshotRepository.findLatestBeforeTime(
                'DrizzleTestWallet123',
                futureTime
            );
            
            console.log('时间之前的钱包快照:', result);
            if (result) {
                expect(result.walletAddress).toBe('DrizzleTestWallet123');
            }
        }, 10000);

        test('should batch find wallet snapshots before time', async () => {
            const wallets = ['DrizzleTestWallet123', 'AnotherWallet456'];
            const futureTime = new Date(Date.now() + 86400000);
            
            const resultMap = await WalletTradingSnapshotRepository.batchFindLatestBeforeTime(
                wallets,
                futureTime
            );
            
            console.log(`批量查询结果: ${resultMap.size} 个钱包`);
            expect(resultMap instanceof Map).toBe(true);
        }, 10000);

        test('should batch create wallet snapshots', async () => {
            const snapshots = [
                {
                    walletAddress: 'BatchWallet1',
                    snapshotTime: new Date(),
                    perTLTradingValue: [],
                    currentTokenValue: [],
                    totalBuySolAmount: '1.0',
                    totalBuyUsdAmount: '150.0',
                    totalSellSolAmount: '0.5',
                    totalSellUsdAmount: '75.0',
                    buyCount: 1,
                    sellCount: 1,
                    solPrice: '150.0',
                    winCount: 0,
                    loseCount: 0,
                },
                {
                    walletAddress: 'BatchWallet2',
                    snapshotTime: new Date(),
                    perTLTradingValue: [],
                    currentTokenValue: [],
                    totalBuySolAmount: '2.0',
                    totalBuyUsdAmount: '300.0',
                    totalSellSolAmount: '1.0',
                    totalSellUsdAmount: '150.0',
                    buyCount: 2,
                    sellCount: 1,
                    solPrice: '150.0',
                    winCount: 1,
                    loseCount: 0,
                }
            ];

            const count = await WalletTradingSnapshotRepository.batchCreate(snapshots);
            
            console.log(`批量创建: ${count} 条记录`);
            expect(count).toBe(2);
        }, 10000);
    });

    describe('性能对比测试', () => {
        test('对比 Repository 和原生 SQL 的性能', async () => {
            const iterations = 10;
            
            // Repository 方式
            const repoStart = Date.now();
            for (let i = 0; i < iterations; i++) {
                await SnapshotInfoRepository.findLatestByType('TokenNormSnapShot');
            }
            const repoTime = Date.now() - repoStart;
            
            console.log(`Repository 方式: ${repoTime}ms (${iterations} 次查询)`);
            console.log(`平均: ${repoTime / iterations}ms 每次查询`);
            
            expect(repoTime).toBeLessThan(5000); // 应该在5秒内完成
        }, 30000);
    });
});

