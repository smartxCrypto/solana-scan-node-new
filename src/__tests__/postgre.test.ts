import { 
    SnapshotInfoRepository,
    TokenSnapshotRepository,
    WalletTradingSnapshotRepository,
    TokenRepository,
    LpInfoRepository,
    SmartMoneyRepository
} from "../database/repositories";
import { testConnection, closeConnection } from "../database/client";

describe('PostgreSQL Tests with Drizzle ORM', () => {
    
    beforeAll(async () => {
        const connected = await testConnection();
        if (!connected) {
            throw new Error('无法连接到数据库');
        }
    });

    afterAll(async () => {
        await closeConnection();
    });

    describe('SnapshotInfo Repository', () => {
        test('should create and query snapshot_info', async () => {
            const timestamp = Math.floor(Date.now() / 1000);
            const result = await SnapshotInfoRepository.create({
                timestamp,
                type: 'TokenNormSnapShot',
                blockHeight: 123456,
                blockTime: timestamp,
            });

            console.log('插入结果:', result);
            expect(result.id).toBeDefined();
            expect(result.type).toBe('TokenNormSnapShot');

            // 查询刚插入的数据
            const found = await SnapshotInfoRepository.findById(result.id);
            expect(found).toBeDefined();
            expect(found?.blockHeight).toBe(123456);
        }, 10000);

        test('should update snapshot_info', async () => {
            const timestamp = Math.floor(Date.now() / 1000);
            const created = await SnapshotInfoRepository.create({
                timestamp,
                type: 'TokenNormSnapShot',
                blockHeight: 999999,
                blockTime: timestamp,
            });

            const updated = await SnapshotInfoRepository.update(created.id, {
                blockHeight: 888888,
            });

            expect(updated?.blockHeight).toBe(888888);
        }, 10000);

        test('should delete snapshot_info', async () => {
            const timestamp = Math.floor(Date.now() / 1000);
            const created = await SnapshotInfoRepository.create({
                timestamp,
                type: 'TokenNormSnapShot',
                blockHeight: 777777,
                blockTime: timestamp,
            });

            const deleted = await SnapshotInfoRepository.delete(created.id);
            expect(deleted).toBe(true);

            const found = await SnapshotInfoRepository.findById(created.id);
            expect(found).toBeUndefined();
        }, 10000);
    });

    describe('TokenSnapshot Repository', () => {
        test('should create token_ss', async () => {
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

            console.log('Token SS 插入结果:', result);
            expect(result.id).toBeDefined();
            expect(result.tokenAddress).toBe('DrizzleTestToken123');
        }, 10000);
    });

    describe('WalletTradingSnapshot Repository', () => {
        test('should create wallet_trading_ss with JSONB', async () => {
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

            console.log('Wallet Trading SS 插入结果:', result);
            expect(result.id).toBeDefined();
            expect(result.walletAddress).toBe('DrizzleTestWallet123');
        }, 10000);
    });

    describe('Token Repository', () => {
        test('should create and find token', async () => {
            const tokenData = {
                name: 'Test Token',
                symbol: 'TEST',
                tokenAddress: 'TestToken' + Date.now(),
                decimals: 9,
                totalSupply: '1000000000',
            };

            const created = await TokenRepository.create(tokenData);
            console.log('创建代币:', created);
            expect(created.tokenAddress).toBe(tokenData.tokenAddress);

            const found = await TokenRepository.findByAddress(tokenData.tokenAddress);
            expect(found).toBeDefined();
            expect(found?.symbol).toBe('TEST');
        }, 10000);

        test('should upsert token', async () => {
            const tokenAddress = 'UpsertTest' + Date.now();
            
            // 第一次插入
            const first = await TokenRepository.upsert({
                name: 'Upsert Token',
                symbol: 'UPSERT',
                tokenAddress,
                decimals: 9,
                totalSupply: '1000000',
            });
            expect(first.symbol).toBe('UPSERT');

            // 第二次更新
            const second = await TokenRepository.upsert({
                name: 'Upsert Token Updated',
                symbol: 'UPSERT2',
                tokenAddress,
                decimals: 9,
                totalSupply: '2000000',
            });
            expect(second.symbol).toBe('UPSERT2');
        }, 10000);
    });

    describe('LpInfo Repository', () => {
        test('should create and find lp_info', async () => {
            const lpData = {
                poolAddress: 'TestPool' + Date.now(),
                tokenAMint: 'TokenA',
                tokenBMint: 'TokenB',
                tokenASymbol: 'TKA',
                tokenBSymbol: 'TKB',
                tokenAAmount: 1000000,
                tokenBAmount: 2000000,
                liquidityUsd: 10000,
                feeRate: 0.003,
                createdTimestamp: Date.now(),
                lastUpdatedTimestamp: Date.now(),
            };

            const created = await LpInfoRepository.create(lpData);
            console.log('创建LP:', created);
            expect(created.poolAddress).toBe(lpData.poolAddress);

            const found = await LpInfoRepository.findByPoolAddress(lpData.poolAddress);
            expect(found).toBeDefined();
            expect(found?.feeRate).toBe(0.003);
        }, 10000);
    });

    describe('SmartMoney Repository', () => {
        test('should create and find smart_money_address', async () => {
            const smData = {
                walletAddress: 'SmartWallet' + Date.now(),
                label: 'Test Smart Money',
                confidenceScore: '85.5',
                totalPnl: '10000.50',
                winRate: '75.0',
                totalTrades: 100,
                isActive: true,
            };

            const created = await SmartMoneyRepository.create(smData);
            console.log('创建聪明钱:', created);
            expect(created.walletAddress).toBe(smData.walletAddress);

            const found = await SmartMoneyRepository.findByWalletAddress(smData.walletAddress);
            expect(found).toBeDefined();
            expect(found?.label).toBe('Test Smart Money');
        }, 10000);

        test('should find all active smart money', async () => {
            const active = await SmartMoneyRepository.findAllActive();
            console.log(`找到 ${active.length} 个活跃聪明钱地址`);
            expect(Array.isArray(active)).toBe(true);
        }, 10000);
    });

    describe('批量操作测试', () => {
        test('should batch create wallet snapshots', async () => {
            const snapshots = Array.from({ length: 10 }, (_, i) => ({
                walletAddress: `BatchWallet${Date.now()}_${i}`,
                snapshotTime: new Date(),
                perTLTradingValue: [],
                currentTokenValue: [],
                totalBuySolAmount: `${i * 10}.0`,
                totalBuyUsdAmount: `${i * 1500}.0`,
                totalSellSolAmount: `${i * 5}.0`,
                totalSellUsdAmount: `${i * 750}.0`,
                buyCount: i * 2,
                sellCount: i,
                solPrice: '150.0',
                winCount: i,
                loseCount: 0,
            }));

            const count = await WalletTradingSnapshotRepository.batchCreate(snapshots);
            console.log(`批量创建: ${count} 条记录`);
            expect(count).toBe(10);
        }, 15000);
    });
});

