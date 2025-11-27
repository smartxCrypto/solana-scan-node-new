import { SolanaBlockDataHandler } from '../service/SolanaBlockDataHandler';
import { TokenRepository, LpInfoRepository } from '@/database/repositories';
import testDataJson from './__test_result_value__/get_block_parse_result.json';
import { MemeEvent } from '@/type/meme';
import { PoolEvent } from '@/type/pool';

const testData = testDataJson as any[];

describe('MemeEvents and Pool Events Processing', () => {
    const blockNumber = 1234567;
    const blockTimestamp = Math.floor(Date.now() / 1000);

    beforeAll(async () => {
        // 可以在这里初始化数据库连接
    });

    describe('handleMemeTokenCreation', () => {
        it('should process CREATE events from memeEvents', async () => {
            // 从测试数据中提取 memeEvents
            const allMemeEvents: any[] = [];
            
            for (const tx of testData) {
                if (tx.memeEvents && tx.memeEvents.length > 0) {
                    allMemeEvents.push(...tx.memeEvents);
                }
            }

            // 筛选 CREATE 事件
            const createEvents = allMemeEvents.filter(event => event.type === 'CREATE');
            
            console.log(`Found ${createEvents.length} CREATE events in test data`);
            console.log('Sample CREATE event:', JSON.stringify(createEvents[0], null, 2));

            expect(createEvents.length).toBeGreaterThan(0);
            
            // 验证 CREATE 事件的结构
            const firstCreate = createEvents[0];
            expect(firstCreate).toHaveProperty('baseMint');
            expect(firstCreate).toHaveProperty('name');
            expect(firstCreate).toHaveProperty('symbol');
            expect(firstCreate).toHaveProperty('creator');

            console.log(`Sample token data:`);
            console.log(`  baseMint: ${firstCreate.baseMint}`);
            console.log(`  name: ${firstCreate.name}`);
            console.log(`  symbol: ${firstCreate.symbol}`);
            console.log(`  creator: ${firstCreate.creator}`);
            console.log(`  bondingCurve: ${firstCreate.bondingCurve}`);
        });

        it('should verify token data can be upserted', async () => {
            const sampleToken = {
                tokenAddress: 'EyG9yC5L3i5TAUnxWk7keXrhY9yQnnWz7QrWPUwjpump',
                name: 'name your dog last thing you ate',
                symbol: 'Nugget',
                decimals: 6,
                totalSupply: '1000000000',
                metaUri: 'https://ipfs.io/ipfs/bafkreig7fnbe7ymrhfnci4vxr6ynjlfadamknwndwqblsha4q2fdwyzz5e',
                creatorAddress: 'AXKD2Rd4rqkCAZo1yhnF1cmHs1jpNLXYhjVgFqFwMhn8',
                createTx: '2EnWN84Ni4KRy7QoAxkYagad6aSq2igbgLQmGVyoBrgP31j6XbWiSoSbA8c4bbKpK4xkyGnc8JNToPt8et1rP8J',
                tokenCreateTs: blockTimestamp,
                firstSeenTimestamp: blockTimestamp,
            };

            console.log('Testing token upsert with data:', JSON.stringify(sampleToken, null, 2));

            try {
                const result = await TokenRepository.upsert(sampleToken);
                expect(result).toBeDefined();
                expect(result.tokenAddress).toBe(sampleToken.tokenAddress);
                console.log('✅ Token upsert successful');
            } catch (error) {
                console.error('❌ Token upsert failed:', error);
                throw error;
            }
        });
    });

    describe('handleMemeMigration', () => {
        it('should identify MIGRATE events', async () => {
            const allMemeEvents: any[] = [];
            
            for (const tx of testData) {
                if (tx.memeEvents && tx.memeEvents.length > 0) {
                    allMemeEvents.push(...tx.memeEvents);
                }
            }

            const migrateEvents = allMemeEvents.filter(event => event.type === 'MIGRATE');
            
            console.log(`Found ${migrateEvents.length} MIGRATE events in test data`);
            
            if (migrateEvents.length > 0) {
                console.log('Sample MIGRATE event:', JSON.stringify(migrateEvents[0], null, 2));
            } else {
                console.log('⚠️  No MIGRATE events found in test data');
            }
        });
    });

    describe('handlePoolCreation', () => {
        it('should process CREATE events from liquidities', async () => {
            const allLiquidities: any[] = [];
            
            for (const tx of testData) {
                if (tx.liquidities && tx.liquidities.length > 0) {
                    allLiquidities.push(...tx.liquidities);
                }
            }

            const createEvents = allLiquidities.filter(event => event.type === 'CREATE');
            
            console.log(`Found ${createEvents.length} pool CREATE events in test data`);
            
            if (createEvents.length > 0) {
                const firstCreate = createEvents[0];
                console.log('Sample pool CREATE event:', JSON.stringify(firstCreate, null, 2));
                
                expect(firstCreate).toHaveProperty('poolId');
                expect(firstCreate).toHaveProperty('token0Mint');
                expect(firstCreate).toHaveProperty('token1Mint');

                console.log(`Sample pool data:`);
                console.log(`  poolId: ${firstCreate.poolId}`);
                console.log(`  token0Mint: ${firstCreate.token0Mint}`);
                console.log(`  token1Mint: ${firstCreate.token1Mint}`);
                console.log(`  token0Amount: ${firstCreate.token0Amount}`);
                console.log(`  token1Amount: ${firstCreate.token1Amount}`);
            } else {
                console.log('⚠️  No pool CREATE events found in test data');
            }
        });

        it('should verify LP data can be upserted', async () => {
            const sampleLp = {
                poolAddress: 'FUELey1TGRhRthcaYgZqJ1UWtiHWADTqebjcj5Pw55bS',
                tokenAMint: 'EyG9yC5L3i5TAUnxWk7keXrhY9yQnnWz7QrWPUwjpump',
                tokenBMint: 'So11111111111111111111111111111111111111112',
                tokenASymbol: 'Nugget',
                tokenBSymbol: 'SOL',
                tokenAAmount: 0,
                tokenBAmount: 0,
                liquidityUsd: 0,
                feeRate: 0.01,
                createdTimestamp: blockTimestamp,
                lastUpdatedTimestamp: blockTimestamp,
            };

            console.log('Testing LP upsert with data:', JSON.stringify(sampleLp, null, 2));

            try {
                const result = await LpInfoRepository.upsert(sampleLp);
                expect(result).toBeDefined();
                expect(result.poolAddress).toBe(sampleLp.poolAddress);
                console.log('✅ LP upsert successful');
            } catch (error) {
                console.error('❌ LP upsert failed:', error);
                throw error;
            }
        });
    });

    describe('Event Statistics', () => {
        it('should count all event types in test data', () => {
            let totalMemeEvents = 0;
            let createEvents = 0;
            let migrateEvents = 0;
            let buyEvents = 0;
            let sellEvents = 0;
            let totalLiquidities = 0;
            let poolCreateEvents = 0;
            let poolAddEvents = 0;
            let poolRemoveEvents = 0;

            for (const tx of testData) {
                if (tx.memeEvents && tx.memeEvents.length > 0) {
                    totalMemeEvents += tx.memeEvents.length;
                    for (const event of tx.memeEvents) {
                        if (event.type === 'CREATE') createEvents++;
                        else if (event.type === 'MIGRATE') migrateEvents++;
                        else if (event.type === 'BUY') buyEvents++;
                        else if (event.type === 'SELL') sellEvents++;
                    }
                }
                
                if (tx.liquidities && tx.liquidities.length > 0) {
                    totalLiquidities += tx.liquidities.length;
                    for (const event of tx.liquidities as any[]) {
                        if (event.type === 'CREATE') poolCreateEvents++;
                        else if (event.type === 'ADD') poolAddEvents++;
                        else if (event.type === 'REMOVE') poolRemoveEvents++;
                    }
                }
            }

            console.log('\n=== Event Statistics ===');
            console.log(`Total memeEvents: ${totalMemeEvents}`);
            console.log(`  - CREATE: ${createEvents}`);
            console.log(`  - MIGRATE: ${migrateEvents}`);
            console.log(`  - BUY: ${buyEvents}`);
            console.log(`  - SELL: ${sellEvents}`);
            console.log(`\nTotal liquidities: ${totalLiquidities}`);
            console.log(`  - CREATE: ${poolCreateEvents}`);
            console.log(`  - ADD: ${poolAddEvents}`);
            console.log(`  - REMOVE: ${poolRemoveEvents}`);
            console.log('======================\n');

            expect(totalMemeEvents).toBeGreaterThan(0);
        });
    });
});

