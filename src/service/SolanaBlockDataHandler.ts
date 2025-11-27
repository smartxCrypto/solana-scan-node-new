import { exportDexparserInstance } from "../collection/dex-parser";
import { MathUtil } from "../utils/MathUtil";
import { SOLANA_DEX_ADDRESS_TO_NAME, SOLANA_DEX_BASE_TOKEN } from "../constant/index";
import { TokenPriceService } from "./TokenPriceService";
import { ParseResult } from "../type/index";
import clickhouseClient from "../constant/config/clickhouse";
import { ESwapTradeType, SwapTransactionToken, TokenSwapFilterData } from "../type/swap";
import { BLACK_LIST_TOKEN } from "../constant/address_data/black_list";
import { WALLET_BLACKLIST } from "../constant/address_data/wallet_black_list";
import { MEVBOT_ADDRESSES } from "../constant/address_data/mev_list";
import { SNAP_SHOT_CONFIG } from "../constant/config";
import { BlockDataSerializer } from "@/scan/BlockDataSerializer";
import { LpInfoUpdate } from "./lpInfo";
import redisClient from "@/constant/config/redis";
import solana_connect_instance from "@/lib/solana";
import { LpInfoRepository, TokenRepository } from "@/database/repositories";
import { getTokenInfoUseCache } from "@/service/TokenInfoService";
import { MemeEvent } from "@/type/meme";
import { PoolEvent } from "@/type/pool";

interface SwapTransaction {
    txHash: string;
    transactionTime: number; // 秒级时间戳
    walletAddress: string;
    tokenAmount: number;
    tokenSymbol: string;
    tokenAddress: string;
    quoteSymbol: string;
    quoteAmount: number;
    quoteAddress: string;
    quotePrice: string;
    usdPrice: string;
    usdAmount: string;
    tradeType: string;
    poolAddress: string;
    blockHeight: number;
}

export class SolanaBlockDataHandler {
    private static stopped = false;
    private static started = false;
    private static processing = false;
    private static shutdownPromise: Promise<void> | null = null;
    private static shutdownResolve: (() => void) | null = null;
    private static lpinfo_cache = `LP_INFO_CACHE_KEY`;
    private static consumerName = `consumer_${process.pid}`;
    private static batchSize = 10;
    private static blockTimeout = 5000;
    private static pendingIdleTimeout = 300000; // 5分钟
    
    public static async start() {
        // 防止重复启动
        if (this.started) {
            console.log(`⚠️  Consumer 已经在运行中，忽略重复启动请求`);
            return;
        }
        
        // 如果已经停止，不允许重新启动
        if (this.stopped) {
            console.log(`⚠️  Consumer 已停止，无法重新启动`);
            return;
        }
        
        this.started = true;
        console.log(`🚀 Consumer '${this.consumerName}' started (PID: ${process.pid})`);
        
        // 检查停止标志
        if (this.stopped) {
            console.log(`🛑 Consumer 在启动过程中收到停止信号，取消启动`);
            this.started = false;
            return;
        }
        
        // 确保消费者组已创建
        await BlockDataSerializer.initConsumerGroup();
        
        // 再次检查停止标志（可能在 initConsumerGroup 期间收到停止信号）
        if (this.stopped) {
            console.log(`🛑 Consumer 在初始化后收到停止信号，取消启动`);
            this.started = false;
            return;
        }
        
        while (!this.stopped) {
            try {
                // 检查停止标志
                if (this.stopped) {
                    break;
                }
                
                // 1. 首先处理 Pending 消息（之前未确认的消息）
                this.processing = true;
                await this.processPendingMessages();
                this.processing = false;
                
                // 再次检查停止标志
                if (this.stopped) {
                    break;
                }
                
                // 2. 读取新消息
                this.processing = true;
                await this.processNewMessages();
                this.processing = false;
                
            } catch (error) {
                this.processing = false;
                // 如果是停止信号，不记录错误
                if (this.stopped && (error as any)?.message?.includes('disconnect') || 
                    (error as any)?.code === 'ECONNRESET') {
                    console.log(`ℹ️  Redis connection closed during shutdown`);
                    break;
                }
                console.error(`❌ Consumer loop error:`, error);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`🛑 Consumer '${this.consumerName}' stopped`);
        this.started = false;
        
        // 如果有等待关闭的 Promise，resolve 它
        if (this.shutdownResolve) {
            this.shutdownResolve();
            this.shutdownResolve = null;
        }
    }

    public static async stop(): Promise<void> {
        if (this.stopped) {
            return;
        }
        
        console.log(`🛑 [SolanaBlockDataHandler] 实例 ${process.pid} 开始优雅关闭...`);
        this.stopped = true;
        
        // 如果还没有启动，直接返回
        if (!this.started) {
            console.log(`ℹ️  Consumer 尚未启动，无需关闭`);
            return;
        }
        
        // 如果正在处理，等待完成
        if (this.processing) {
            console.log(`⏳ 等待当前操作完成...`);
            
            // 创建一个 Promise 来等待处理完成
            if (!this.shutdownPromise) {
                this.shutdownPromise = new Promise<void>((resolve) => {
                    this.shutdownResolve = resolve;
                });
            }
            
            // 设置超时，最多等待10秒
            const timeout = setTimeout(() => {
                console.log(`⚠️  等待超时，强制退出`);
                if (this.shutdownResolve) {
                    this.shutdownResolve();
                }
            }, 10000);
            
            await this.shutdownPromise;
            clearTimeout(timeout);
        }
        
        console.log(`✅ [SolanaBlockDataHandler] 实例 ${process.pid} 已停止`);
    }

    private static async processNewMessages(): Promise<void> {
        try {
            // 如果已停止，使用较短的阻塞时间以便快速退出
            const blockTime = this.stopped ? 100 : this.blockTimeout;
            
            const messages: any = await redisClient.xReadGroup(
                BlockDataSerializer.consumer_group,
                this.consumerName,
                [
                    {
                        key: BlockDataSerializer.stream_key,
                        id: '>'
                    }
                ],
                {
                    COUNT: this.batchSize,
                    BLOCK: blockTime
                }
            );
            
            // 检查停止标志
            if (this.stopped) {
                return;
            }
            
            if (!messages || !Array.isArray(messages) || messages.length === 0) {
                return;
            }
            
            for (const stream of messages) {
                // 再次检查停止标志
                if (this.stopped) {
                    break;
                }
                
                if (stream.messages && Array.isArray(stream.messages)) {
                    for (const message of stream.messages) {
                        if (this.stopped) {
                            break;
                        }
                        await this.processMessage(message.id, message.message);
                    }
                }
            }
            
        } catch (error) {
            // 如果是停止时的连接错误，忽略
            if (this.stopped && ((error as any)?.message?.includes('disconnect') || 
                (error as any)?.code === 'ECONNRESET')) {
                return;
            }
            console.error(`❌ Error reading new messages:`, error);
        }
    }
    
    private static async processPendingMessages(): Promise<void> {
        try {
            // 检查停止标志
            if (this.stopped) {
                return;
            }
            
            const pending: any = await redisClient.xPending(
                BlockDataSerializer.stream_key,
                BlockDataSerializer.consumer_group,
                '-', '+',
                10,
                this.consumerName
            );
            
            // 再次检查停止标志
            if (this.stopped) {
                return;
            }
            
            if (!pending || !pending.messages || pending.messages.length === 0) {
                return;
            }
            
            console.log(`⚠️  Found ${pending.messages.length} pending messages`);
            
            for (const msg of pending.messages) {
                // 检查停止标志
                if (this.stopped) {
                    break;
                }
                
                const idleTime = msg.millisecondsSinceLastDelivery || 0;
                
                if (idleTime > this.pendingIdleTimeout) {
                    console.log(`⏰ Message ${msg.id} idle for ${idleTime}ms, reclaiming...`);
                    
                    try {
                        const claimed: any = await redisClient.xClaim(
                            BlockDataSerializer.stream_key,
                            BlockDataSerializer.consumer_group,
                            this.consumerName,
                            60000,
                            [msg.id]
                        );
                        
                        // 检查停止标志
                        if (this.stopped) {
                            break;
                        }
                        
                        if (claimed && Array.isArray(claimed)) {
                            for (const claimedMsg of claimed) {
                                if (this.stopped) {
                                    break;
                                }
                                if (claimedMsg && claimedMsg.id && claimedMsg.message) {
                                    await this.processMessage(claimedMsg.id, claimedMsg.message);
                                }
                            }
                        }
                    } catch (error) {
                        // 如果是停止时的连接错误，忽略
                        if (this.stopped && ((error as any)?.message?.includes('disconnect') || 
                            (error as any)?.code === 'ECONNRESET')) {
                            break;
                        }
                        console.error(`❌ Failed to claim message ${msg.id}:`, error);
                    }
                } else {
                    // 检查停止标志
                    if (this.stopped) {
                        break;
                    }
                    
                    const messages = await redisClient.xRange(
                        BlockDataSerializer.stream_key,
                        msg.id,
                        msg.id
                    );
                    
                    // 检查停止标志
                    if (this.stopped) {
                        break;
                    }
                    
                    if (messages && messages.length > 0) {
                        await this.processMessage(messages[0].id, messages[0].message);
                    }
                }
            }
            
        } catch (error) {
            console.error(`❌ Error processing pending messages:`, error);
        }
    }
    
    private static async processMessage(
        messageId: string,
        messageData: any
    ): Promise<void> {
        const blockNumber = Number(messageData.blockNumber);
        
        try {
            console.log(`🔄 Processing block ${blockNumber} (message: ${messageId})`);
            
            const blockData = BlockDataSerializer.deserialize(messageData.blockData);
            
            const swapTransactionArray = await this.handleBlockDataWithBlockData(
                blockData,
                blockNumber
            );
            
            if (swapTransactionArray.length > 0) {
                await Promise.all([
                    this.insertToTokenTable(swapTransactionArray),
                    this.insertToWalletTable(swapTransactionArray)
                ]);
            }
            
            await redisClient.xAck(
                BlockDataSerializer.stream_key,
                BlockDataSerializer.consumer_group,
                messageId
            );
            
            // 删除已处理的消息，释放内存
            await redisClient.xDel(BlockDataSerializer.stream_key, messageId);
            
            console.log(`✅ Block ${blockNumber} processed and ACKed (message: ${messageId})`);
            
        } catch (error) {
            console.error(`❌ Error processing block ${blockNumber}:`, error);
        }
    }

    public static async handleBlockData(
        blockNumber: number,
    ) {
        const start = Date.now();
        let blockData = await BlockDataSerializer.getBlockDataFromRedis(blockNumber);
        if (!blockData) {
            await redisClient.hdel(BlockDataSerializer.cache_key, String(blockNumber));
            return;
        }

        const swapTransactionArray = await this.handleBlockDataWithBlockData(blockData, blockNumber);
        const insertStart = Date.now();
        if (swapTransactionArray.length > 0) {
            await Promise.all([
                this.insertToTokenTable(swapTransactionArray),
                this.insertToWalletTable(swapTransactionArray)
            ]);
        }
        // if (lpArray.length > 0) {
        //     this.batchUpsertLpInfo(lpArray, blockData.blockTime?.timestamp);
        // }
        console.log(
            `insert cost:${Date.now() - insertStart} ms,blockNumber:${blockNumber}`);
        console.log(`handleBlockData cost:${Date.now() - start} ms,blockNumber:${blockNumber}`);
    }

    public static async handleBlockDataWithBlockData(
        blockData: any,
        blockNumber: number,
    ) {
        const parseResult = await exportDexparserInstance.parseBlockData(
            blockData,
            blockNumber,
        );
        const fileteTransactions = parseResult.filter((tx) =>
            tx.trades?.length > 0
        );
        const convertStart = Date.now();
        const swapTransactionArray = [];
        const solPrice = await TokenPriceService.getPrice("SOL", "USDT");
        const tokenPriceMap = {};

        for (let index = 0; index < fileteTransactions.length; index++) {
            const tx = fileteTransactions[index];
            for (let index = 0; index < tx.trades.length; index++) {

                try {
                    const swapTransaction = await SolanaBlockDataHandler.convertData(
                        tx,
                        index,
                        blockNumber,
                        solPrice,
                        Number(blockData.blockTime?.timestamp),
                        tokenPriceMap
                    );
                    if (swapTransaction) {
                        swapTransactionArray.push(swapTransaction);
                    }
                } catch (error) {
                    console.log("SolanaBlockDataHandler.convertData error", error);
                }
            }
        }

        console.log(
            `convertData cost:${Date.now() - convertStart} ms,blockNumber:${blockNumber},blockTime:${blockData.blockTime?.timestamp}`);
        
        // === 新增：处理所有交易中的 memeEvents 和 liquidities ===
        const blockTimestamp = Number(blockData.blockTime?.timestamp);
        
        // 收集所有交易的 memeEvents 和 liquidities
        const allMemeEvents: MemeEvent[] = [];
        const allLiquidities: PoolEvent[] = [];
        
        for (const tx of parseResult) {
            if (tx.memeEvents?.length > 0) {
                allMemeEvents.push(...tx.memeEvents);
            }
            if (tx.liquidities?.length > 0) {
                allLiquidities.push(...tx.liquidities);
            }
        }
        
        // 并行处理代币创建、池子创建和迁移事件
        const eventProcessStart = Date.now();
        try {
            await Promise.all([
                this.handleMemeTokenCreation(allMemeEvents, blockNumber, blockTimestamp),
                this.handleMemeMigration(allMemeEvents, blockNumber, blockTimestamp),
                this.handlePoolCreation(allLiquidities, blockNumber, blockTimestamp, tokenPriceMap)
            ]);
            console.log(`事件处理耗时: ${Date.now() - eventProcessStart} ms`);
        } catch (error) {
            console.error(`处理事件时出错:`, error);
        }
        
        // 现有的 LP info 更新逻辑
        this.convertToLpInfoUpdateList(fileteTransactions, blockTimestamp, tokenPriceMap);
        
        return swapTransactionArray;
    }

    static convertToLpInfoUpdateList(fileteTransactions: any[], blockTime: number, tokenPriceMap: any): LpInfoUpdate[] {
        const uniqueMap = new Map<string, LpInfoUpdate>();

        for (const tx of fileteTransactions) {
            const liquidity = tx.result?.liquidities?.[0];
            if (!liquidity || !liquidity.pool_address) continue;

            const poolAddress = liquidity.pool_address;
            // console.log("poolAddress:", poolAddress, " liquidity_usd:", liquidity.liquidity_usd);
            if (!uniqueMap.has(poolAddress)) {
                uniqueMap.set(poolAddress, {
                    pool_address: poolAddress,
                    token_a_mint: liquidity.token_a_mint,
                    token_b_mint: liquidity.token_b_mint,
                    token_a_symbol: liquidity.token_a_symbol,
                    token_b_symbol: liquidity.token_b_symbol,
                    token_a_amount: liquidity.token_a_amount,
                    token_b_amount: liquidity.token_b_amount,
                    liquidity_usd: liquidity.liquidity_usd,
                    fee_rate: liquidity.fee_rate,
                    transactinTimeTs: blockTime,
                });
            }
        }
        uniqueMap.forEach((value, key) => {
            redisClient.hset(
                this.lpinfo_cache,
                key,
                JSON.stringify(value));
        });
        return Array.from(uniqueMap.values());
    }

    /**
     * 处理 memeEvents 中的 CREATE 事件，提取代币创建信息
     * 对应数据示例见：get_block_parse_result.json line 7596-7611
     */
    private static async handleMemeTokenCreation(
        memeEvents: MemeEvent[], 
        blockNumber: number,
        blockTimestamp: number
    ): Promise<void> {
        const createEvents = memeEvents.filter(event => event.type === 'CREATE');
        
        if (createEvents.length === 0) {
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const event of createEvents) {
            try {
                const tokenAddress = event.baseMint;
                if (!tokenAddress) {
                    continue;
                }

                const tokenData = {
                    tokenAddress: tokenAddress,
                    name: event.name || '',
                    symbol: event.symbol || '',
                    decimals: event.decimals || 6, // 默认6位小数
                    totalSupply: String(event.totalSupply || 1000000000), // 默认10亿
                    metaUri: event.uri || '',
                    creatorAddress: event.creator || event.user || '',
                    createTx: event.signature || '',
                    tokenCreateTs: event.timestamp || blockTimestamp,
                    firstSeenTimestamp: event.timestamp || blockTimestamp,
                };

                await TokenRepository.upsert(tokenData);
                successCount++;

                // 如果有 bondingCurve 地址，可以作为初始池子信息记录
                if (event.bondingCurve && event.quoteMint) {
                    try {
                        const quoteSymbol = SOLANA_DEX_ADDRESS_TO_NAME[event.quoteMint] || '';
                        await LpInfoRepository.upsert({
                            poolAddress: event.bondingCurve,
                            tokenAMint: tokenAddress,
                            tokenBMint: event.quoteMint,
                            tokenASymbol: event.symbol || '',
                            tokenBSymbol: quoteSymbol,
                            tokenAAmount: 0,
                            tokenBAmount: 0,
                            liquidityUsd: 0,
                            feeRate: 0.01, // bonding curve 通常是 1%
                            createdTimestamp: event.timestamp || blockTimestamp,
                            lastUpdatedTimestamp: event.timestamp || blockTimestamp,
                        });
                    } catch (lpError) {
                        console.error(`Failed to create LP info for bonding curve ${event.bondingCurve}:`, lpError);
                    }
                }

            } catch (error) {
                console.error(`Failed to upsert token ${event.baseMint}:`, error);
                failCount++;
            }
        }

        if (successCount > 0) {
            console.log(`✅ 处理 ${successCount} 个代币创建事件 (失败: ${failCount})`);
        }
    }

    /**
     * 处理 memeEvents 中的 MIGRATE 事件
     * 迁移通常发生在 bonding curve 完成后代币转移到 DEX（如 Raydium）
     */
    private static async handleMemeMigration(
        memeEvents: MemeEvent[],
        blockNumber: number,
        blockTimestamp: number
    ): Promise<void> {
        const migrateEvents = memeEvents.filter(event => event.type === 'MIGRATE');
        
        if (migrateEvents.length === 0) {
            return;
        }

        let updateCount = 0;
        let createCount = 0;
        let failCount = 0;

        for (const event of migrateEvents) {
            try {
                // 更新旧池子（bondingCurve）
                if (event.bondingCurve) {
                    try {
                        const existingPool = await LpInfoRepository.findByPoolAddress(event.bondingCurve);
                        if (existingPool) {
                            await LpInfoRepository.update(event.bondingCurve, {
                                lastUpdatedTimestamp: event.timestamp || blockTimestamp,
                            });
                            updateCount++;
                        }
                    } catch (updateError) {
                        console.error(`Failed to update bonding curve ${event.bondingCurve}:`, updateError);
                    }
                }

                // 创建新池子
                if (event.pool && event.baseMint && event.quoteMint) {
                    try {
                        const quoteSymbol = SOLANA_DEX_ADDRESS_TO_NAME[event.quoteMint] || '';
                        const baseSymbol = event.symbol || '';
                        
                        await LpInfoRepository.upsert({
                            poolAddress: event.pool,
                            tokenAMint: event.baseMint,
                            tokenBMint: event.quoteMint,
                            tokenASymbol: baseSymbol,
                            tokenBSymbol: quoteSymbol,
                            tokenAAmount: event.poolAReserve || 0,
                            tokenBAmount: event.poolBReserve || 0,
                            liquidityUsd: 0, // 需要后续计算
                            feeRate: event.poolFeeRate || 0.003, // 默认 0.3%
                            createdTimestamp: event.timestamp || blockTimestamp,
                            lastUpdatedTimestamp: event.timestamp || blockTimestamp,
                        });
                        createCount++;
                    } catch (createError) {
                        console.error(`Failed to create new pool ${event.pool}:`, createError);
                        failCount++;
                    }
                }

            } catch (error) {
                console.error(`Failed to handle migration event:`, error);
                failCount++;
            }
        }

        if (updateCount > 0 || createCount > 0) {
            console.log(`✅ 处理 ${migrateEvents.length} 个迁移事件 (更新: ${updateCount}, 创建: ${createCount}, 失败: ${failCount})`);
        }
    }

    /**
     * 处理 liquidities 数组中的 CREATE 事件
     * 对应类型：PoolEvent with type='CREATE'
     */
    private static async handlePoolCreation(
        liquidities: PoolEvent[],
        blockNumber: number,
        blockTimestamp: number,
        tokenPriceMap: any
    ): Promise<void> {
        const createEvents = liquidities.filter(event => event.type === 'CREATE');
        
        if (createEvents.length === 0) {
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const event of createEvents) {
            try {
                if (!event.poolId || !event.token0Mint || !event.token1Mint) {
                    continue;
                }

                // 获取代币信息
                let token0Symbol = '';
                let token1Symbol = '';
                
                // 先尝试从 DEX 基础代币列表获取
                token0Symbol = SOLANA_DEX_ADDRESS_TO_NAME[event.token0Mint] || '';
                token1Symbol = SOLANA_DEX_ADDRESS_TO_NAME[event.token1Mint] || '';

                // 如果没有找到，尝试从缓存获取
                if (!token0Symbol) {
                    const token0Info = await getTokenInfoUseCache(event.token0Mint);
                    token0Symbol = token0Info?.symbol || '';
                }
                if (!token1Symbol) {
                    const token1Info = await getTokenInfoUseCache(event.token1Mint);
                    token1Symbol = token1Info?.symbol || '';
                }

                // 计算流动性 USD 价值
                let liquidityUsd = 0;
                const token0Amount = event.token0Amount || 0;
                const token1Amount = event.token1Amount || 0;

                // 尝试使用 token0 的价格
                if (tokenPriceMap[event.token0Mint]) {
                    liquidityUsd = token0Amount * tokenPriceMap[event.token0Mint] * 2;
                } 
                // 尝试使用 token1 的价格
                else if (tokenPriceMap[event.token1Mint]) {
                    liquidityUsd = token1Amount * tokenPriceMap[event.token1Mint] * 2;
                }
                // 如果 token1 是 SOL/WSOL，使用 SOL 价格
                else if (token1Symbol === 'SOL' || token1Symbol === 'WSOL') {
                    const solPrice = await TokenPriceService.getPrice("SOL", "USDT");
                    liquidityUsd = token1Amount * solPrice * 2;
                }

                await LpInfoRepository.upsert({
                    poolAddress: event.poolId,
                    tokenAMint: event.token0Mint,
                    tokenBMint: event.token1Mint,
                    tokenASymbol: token0Symbol,
                    tokenBSymbol: token1Symbol,
                    tokenAAmount: Number(event.token0AmountRaw || event.token0Amount || 0),
                    tokenBAmount: Number(event.token1AmountRaw || event.token1Amount || 0),
                    liquidityUsd: Number(liquidityUsd),
                    feeRate: 0.003, // 默认 0.3%，可以从事件中获取如果有的话
                    createdTimestamp: event.timestamp || blockTimestamp,
                    lastUpdatedTimestamp: event.timestamp || blockTimestamp,
                });

                successCount++;

            } catch (error) {
                console.error(`Failed to create pool ${event.poolId}:`, error);
                failCount++;
            }
        }

        if (successCount > 0) {
            console.log(`✅ 处理 ${successCount} 个池子创建事件 (失败: ${failCount})`);
        }
    }

    static async convertData(
        parseResult: ParseResult,
        index: number,
        blockNumber: number,
        solPrice: number,
        blockTime: number,
        tokenPriceMap: any
    ): Promise<SwapTransaction | null> {
        if (parseResult.trades.length === 0) {
            return null;
        }
        let tradeType = parseResult.trades[index].type;
        const txHash = parseResult.signature;
        const transactionTime = blockTime;
        const walletAddress = parseResult.trades[index].user;
        let tokenAmount;
        let tokenSymbol;
        let tokenAddress;
        let quoteSymbol;
        let quoteAmount;
        let quoteAddress;
        let quotePrice;
        let poolAddress = parseResult.trades[index].Pool?.[0] || "";
        if (tradeType === "BUY") {
            tokenAmount = parseResult.trades[index].outputToken.amount;
            tokenSymbol = "";
            tokenAddress = parseResult.trades[index].outputToken.mint;
            quoteSymbol = "";
            quoteAmount = parseResult.trades[index].inputToken.amount;
            quoteAddress = parseResult.trades[index].inputToken.mint;
            quotePrice = MathUtil.divide(quoteAmount, tokenAmount); //quoteAmount / tokenAmount;
        } else {
            tokenAmount = parseResult.trades[index].inputToken.amount;
            tokenSymbol = "";
            tokenAddress = parseResult.trades[index].inputToken.mint;
            quoteSymbol = "";
            quoteAmount = parseResult.trades[index].outputToken.amount;
            quoteAddress = parseResult.trades[index].outputToken.mint;
            quotePrice = MathUtil.divide(quoteAmount, tokenAmount); //quoteAmount / tokenAmount;
        }
        quotePrice = MathUtil.toFixed(quotePrice);
        quoteSymbol = SOLANA_DEX_ADDRESS_TO_NAME[quoteAddress];
        if (!quoteSymbol) {
            console.log(`quoteSymbol not support ${quoteAddress} `);
            return null;
        }
        let quoteTokenUSDPrice = 1;
        if (quoteSymbol === "SOL" || quoteSymbol === "WSOL") {
            quoteTokenUSDPrice = solPrice;
        }
        let usdPrice = MathUtil.multiply(quotePrice, quoteTokenUSDPrice); //quotePrice * quoteTokenUSDPrice;
        usdPrice = MathUtil.toFixed(usdPrice);
        let usdAmount = MathUtil.multiply(quoteTokenUSDPrice, quoteAmount); //quoteAmount * usdPrice;
        usdAmount = MathUtil.toFixed(usdAmount);
        tokenPriceMap[tokenAddress] = quotePrice;
        return {
            txHash,
            transactionTime: Number(transactionTime),
            walletAddress,
            tokenAmount,
            tokenSymbol,
            tokenAddress,
            quoteSymbol,
            quoteAmount,
            quoteAddress,
            quotePrice,
            usdPrice,
            usdAmount,
            tradeType,
            poolAddress,
            blockHeight: blockNumber,
        };
    }

    // 写入 wallet 表
    static async insertToWalletTable(rows: SwapTransaction[]) {
        const values = rows.map((tx) => ({
            tx_hash: tx.txHash,
            transaction_time: tx.transactionTime,
            wallet_address: tx.walletAddress,
            token_amount: tx.tokenAmount,
            token_symbol: tx.tokenSymbol,
            token_address: tx.tokenAddress,
            quote_symbol: tx.quoteSymbol,
            quote_amount: tx.quoteAmount,
            quote_address: tx.quoteAddress,
            quote_price: parseFloat(tx.quotePrice),
            usd_price: parseFloat(tx.usdPrice),
            usd_amount: parseFloat(tx.usdAmount),
            trade_type: tx.tradeType,
            block_height: tx.blockHeight,
            pool_address: tx.poolAddress
        }));

        await clickhouseClient.insert({
            table: "solana_swap_transactions_wallet",
            values,
            format: "JSONEachRow",
        });

        console.log(`✅ 插入 ${values.length} 条记录到 solana_swap_transactions_wallet`);
    }

    // 写入 token 表
    static async insertToTokenTable(rows: SwapTransaction[]) {
        const values = rows.map((tx) => ({
            tx_hash: tx.txHash,
            transaction_time: tx.transactionTime,
            wallet_address: tx.walletAddress,
            token_amount: tx.tokenAmount,
            token_symbol: tx.tokenSymbol,
            token_address: tx.tokenAddress,
            quote_symbol: tx.quoteSymbol,
            quote_amount: tx.quoteAmount,
            quote_address: tx.quoteAddress,
            quote_price: parseFloat(tx.quotePrice),
            usd_price: parseFloat(tx.usdPrice),
            usd_amount: parseFloat(tx.usdAmount),
            trade_type: tx.tradeType,
            block_height: tx.blockHeight,
            pool_address: tx.poolAddress
        }));

        await clickhouseClient.insert({
            table: "solana_swap_transactions_token",
            values,
            format: "JSONEachRow",
        });

        console.log(`✅ 插入 ${values.length} 条记录到 solana_swap_transactions_token`);
    }

    static async batchUpsertLpInfo(
        lpDataList: LpInfoUpdate[], solUsdPrice: number
    ) {
        const lpDataToUpsert: any[] = [];

        for (const lp of lpDataList) {
            let quoteSymbol = SOLANA_DEX_ADDRESS_TO_NAME[lp.token_a_mint];
            let tokenAddress;
            let quoteAddress;
            let token_amount;
            let quote_amount;
            if (!quoteSymbol) {
                quoteSymbol = SOLANA_DEX_ADDRESS_TO_NAME[lp.token_b_mint];
                if (!quoteSymbol) {
                    console.log(`quoteSymbol not support ${lp.token_a_mint} ${lp.token_b_mint} `);
                    continue;
                }
                tokenAddress = lp.token_a_mint;
                token_amount = lp.token_a_amount;
                quote_amount = lp.token_b_amount;
                quoteAddress = lp.token_b_mint;
            } else {
                tokenAddress = lp.token_b_mint;
                token_amount = lp.token_b_amount;
                quote_amount = lp.token_a_amount;
                quoteAddress = lp.token_a_mint;
            }

            let liquidityUsdValue = MathUtil.multiply(quote_amount, 1);
            if (quoteSymbol === "SOL" || quoteSymbol === "WSOL") {
                liquidityUsdValue = MathUtil.multiply(quote_amount, solUsdPrice);
            }
            liquidityUsdValue = MathUtil.multiply(liquidityUsdValue, 2);
            console.log(`pool${lp.pool_address}  liquidityUsdValue:${liquidityUsdValue}`)
            
            lpDataToUpsert.push({
                poolAddress: lp.pool_address,
                tokenAMint: tokenAddress,
                tokenBMint: quoteAddress,
                tokenASymbol: '',
                tokenBSymbol: quoteSymbol,
                tokenAAmount: Number(token_amount),
                tokenBAmount: Number(quote_amount),
                liquidityUsd: Number(liquidityUsdValue),
                feeRate: lp.fee_rate || 0,
                createdTimestamp: lp.transactinTimeTs,
                lastUpdatedTimestamp: lp.transactinTimeTs,
            });
        }

        try {
            await LpInfoRepository.batchUpsert(lpDataToUpsert);
            for (const lp of lpDataList) {
                redisClient.hdel(this.lpinfo_cache, lp.pool_address);
            }
            console.log(`✅ 插入 ${lpDataList.length} 条记录到 lp_info`);
        } catch (error) {
            console.error("Error in batchUpsertLpInfo:", error);
        }
    }

    static async saveLpInfoFromCache() {
        const allKeys: string[] = await redisClient.hkeys(this.lpinfo_cache);
        if (!allKeys || allKeys.length === 0) return [];
        console.log(`[saveLpInfoFromCache] total keys: ${allKeys.length}`);
        const limit = 100;
        // 截取前 limit 个 key
        const targetKeys = allKeys.slice(0, limit);

        // 分组，每组 100 个
        const batchSize = 100;
        const batches: string[][] = [];
        for (let i = 0; i < targetKeys.length; i += batchSize) {
            batches.push(targetKeys.slice(i, i + batchSize));
        }
        const solUsdPrice = await TokenPriceService.getPrice("SOL", "USDT");
        for (const group of batches) {
            try {
                const start = Date.now();
                const lpList: LpInfoUpdate[] = [];
                for (const key of group) {
                    const value = await redisClient.hget(this.lpinfo_cache, key);
                    if (value) {
                        lpList.push(JSON.parse(value));
                    }
                }
                await this.batchUpsertLpInfo(lpList, solUsdPrice)
                console.log(`[saveLpInfoFromCache] save ${group.length} keys in ${Date.now() - start} ms`);
            } catch (e) {
                console.error(`[loadLpInfoUpdatesFromCache] Redis HMGET failed for keys:`, group, e);
            }
        }
    }

    static async startSaveLpInfoFromCache() {
        while (!this.stopped) {
            try {
                await this.saveLpInfoFromCache();
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (e) {
                console.error(`[startSaveLpInfoFromCache] error:`, e);
            }
        }
    }

    // 读取单位时间后的x条数据
    static async getXDaysData(timestamp: number, limit = 0): Promise<SwapTransactionToken[]> {
        const data = await clickhouseClient.query({
            query: `SELECT *
                    FROM solana_swap_transactions_token
                    WHERE transaction_time > ${timestamp}
                    ORDER BY transaction_time asc ${limit > 0 ? `LIMIT ${limit}` : ''} `,
            format: 'JSONEachRow'
        });
        const rows = await data.json();
        return rows as SwapTransactionToken[];
    }


    static async getXDaysDataByTimestamp(startTimestamp: number, endTimestamp: number, pageNum: number, pageSize: number): Promise<SwapTransactionToken[]> {
        const data = await clickhouseClient.query({
            query: `SELECT *
                    FROM solana_swap_transactions_token
                    WHERE transaction_time > ${startTimestamp}
                      AND transaction_time < ${endTimestamp}
                    ORDER BY transaction_time DESC LIMIT ${pageNum * pageSize}, ${pageSize}`,
            format: 'JSONEachRow'
        });

        const rows = await data.json();
        return rows as SwapTransactionToken[];
    }

    /**
     * 基于区块高度范围获取交易数据
     * @param startBlockHeight 起始区块高度
     * @param endBlockHeight 结束区块高度
     * @returns Promise<SwapTransactionToken[]>
     */
    static async getDataByBlockHeightRange(startBlockHeight: number, endBlockHeight: number): Promise<SwapTransactionToken[]> {
        const data = await clickhouseClient.query({
            query: `SELECT *
                    FROM solana_swap_transactions_token
                    WHERE block_height >= ${startBlockHeight}
                      AND block_height <= ${endBlockHeight}
                    ORDER BY block_height ASC`,
            format: 'JSONEachRow'
        });

        const rows = await data.json();
        return rows as SwapTransactionToken[];
    }

    static async getActiveWalletAfterTransTime(transTime: number): Promise<string[]> {
        const data = await clickhouseClient.query({
            query: `SELECT DISTINCT wallet_address FROM solana_swap_transactions_token WHERE transaction_time > ${transTime} ORDER BY transaction_time DESC`,
            format: 'JSONEachRow'
        });
        const rows = await data.json() as Array<{ wallet_address: string }>;
        return rows.map(row => row.wallet_address);
    }

    static async getActiveWalletExcludingSmartMoney(blocksAgo: number): Promise<string[]> {
        const connection = solana_connect_instance.getConnection();
        const blockHeight = await connection.getSlot();

        const filterBlockHeight = blockHeight - blocksAgo;

        const data = await clickhouseClient.query({
            query: `SELECT DISTINCT wallet_address FROM solana_swap_transactions_token WHERE block_height >= ${filterBlockHeight} ORDER BY block_height DESC`,
            format: 'JSONEachRow'
        });
        const rows = await data.json() as Array<{ wallet_address: string }>;
        return rows.map(row => row.wallet_address);
    }


    static filterTokenData(data: SwapTransactionToken[]): TokenSwapFilterData[] {

        const result: TokenSwapFilterData[] = [];

        for (const transaction of data) {
            if (BLACK_LIST_TOKEN.includes(transaction.token_address) ||
                BLACK_LIST_TOKEN.includes(transaction.quote_address)) {
                continue;
            }
            if (WALLET_BLACKLIST.includes(transaction.wallet_address)) {
                continue;
            }

            if (MEVBOT_ADDRESSES.includes(transaction.wallet_address)) {
                continue;
            }

            const LOWER_DEX_BASE_TOKEN = SOLANA_DEX_BASE_TOKEN.map(token => token.toLowerCase());

            const tokenIsBase = LOWER_DEX_BASE_TOKEN.includes(transaction.token_address.toLowerCase());
            const quoteIsBase = LOWER_DEX_BASE_TOKEN.includes(transaction.quote_address.toLowerCase());

            if (!tokenIsBase && !quoteIsBase) {
                continue;
            }

            if (tokenIsBase && quoteIsBase) {
                continue;
            }

            const calculatedUsdPrice = transaction.usd_price;
            const calculatedUsdAmount = transaction.usd_amount;


            if (calculatedUsdAmount < SNAP_SHOT_CONFIG.MIN_TRANSACTION_AMOUNT) {
                continue;
            }

            // 确保 transactionTime 是字符串格式
            // transaction_time 可能是数字（Unix时间戳）或字符串
            let transactionTime: string;
            if (typeof transaction.transaction_time === 'number') {
                // 如果是数字，转换为ISO字符串格式
                transactionTime = new Date(transaction.transaction_time * 1000).toISOString();
            } else if (typeof transaction.transaction_time === 'string') {
                transactionTime = transaction.transaction_time;
            } else {
                // 如果既不是数字也不是字符串，使用当前时间
                transactionTime = new Date().toISOString();
            }

            const filteredData: TokenSwapFilterData = {
                userAddress: transaction.wallet_address,
                poolAddress: "",
                txHash: transaction.tx_hash,
                isBuy: transaction.trade_type === ESwapTradeType.BUY,
                blockHeight: 0,
                tokenSymbol: transaction.token_symbol,
                tokenAddress: transaction.token_address,
                quoteSymbol: transaction.quote_symbol,
                quoteAddress: transaction.quote_address,
                quotePrice: transaction.quote_price,
                usdPrice: calculatedUsdPrice,
                usdAmount: calculatedUsdAmount,
                transactionTime: transactionTime,
                tokenAmount: transaction.token_amount,
                quoteAmount: transaction.quote_amount,
            };

            result.push(filteredData);
        }

        return result;
    };

    static async getTokenLastTransaction(tokenAddress: string): Promise<SwapTransaction | null> {
        const data = await clickhouseClient.query({
            query: `SELECT * FROM solana_swap_transactions_token WHERE token_address = '${tokenAddress}' ORDER BY transaction_time DESC LIMIT 1`,
            format: 'JSONEachRow'
        });
        const rows = await data.json();
        return rows[0] as SwapTransaction;
    }

    /**
     * 获取购买过特定代币的钱包地址列表
     * @param tokenAddress 代币地址
     * @param timeRangeMinutes 时间范围（分钟），可选参数。不传表示无时间限制
     * @param limit 返回数量限制，默认100
     * @returns Promise<string[]> 钱包地址列表
     */
    static async getWalletAddressesByTokenPurchase(
        tokenAddress: string,
        timeRangeMinutes?: number,
        limit: number = 100
    ): Promise<string[]> {
        try {
            let query = `
        SELECT DISTINCT wallet_address 
        FROM solana_swap_transactions_token 
        WHERE token_address = '${tokenAddress}' AND trade_type = 'BUY'
      `;

            // 如果指定了时间范围，添加时间过滤条件
            if (timeRangeMinutes && timeRangeMinutes > 0) {
                const currentTime = Math.floor(Date.now() / 1000); // 当前时间戳（秒）
                const startTime = currentTime - (timeRangeMinutes * 60); // 指定分钟前的时间戳
                query += ` AND transaction_time >= ${startTime}`;
            }

            query += ` ORDER BY MAX(transaction_time) DESC LIMIT ${limit}`;

            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });

            const rows = await data.json() as Array<{ wallet_address: string }>;
            const walletAddresses = rows.map(row => row.wallet_address);

            console.log(`📊 获取代币 ${tokenAddress} 的购买者地址:`);
            console.log(`   时间范围: ${timeRangeMinutes ? `最近${timeRangeMinutes}分钟` : '无限制'}`);
            console.log(`   找到购买者: ${walletAddresses.length} 个`);
            console.log(`   限制数量: ${limit}`);

            return walletAddresses;

        } catch (error) {
            console.error("Error getting wallet addresses by token purchase:", error);
            console.error(`   代币地址: ${tokenAddress}`);
            console.error(`   时间范围: ${timeRangeMinutes || '无限制'} 分钟`);
            return [];
        }
    }

    /**
     * 获取购买过特定代币的钱包详细信息
     * @param tokenAddress 代币地址
     * @param timeRangeMinutes 时间范围（分钟），可选参数。不传表示无时间限制
     * @param limit 返回数量限制，默认50
     * @param sortBy 排序方式: 'latest' | 'amount' | 'count'
     * @returns Promise<WalletTokenPurchaseInfo[]>
     */
    static async getWalletTokenPurchaseDetails(
        tokenAddress: string,
        timeRangeMinutes?: number,
        limit: number = 50,
        sortBy: 'latest' | 'amount' | 'count' = 'latest'
    ): Promise<WalletTokenPurchaseInfo[]> {
        try {
            let whereClause = `token_address = '${tokenAddress}' AND trade_type = 'BUY'`;

            // 如果指定了时间范围，添加时间过滤条件
            if (timeRangeMinutes && timeRangeMinutes > 0) {
                const currentTime = Math.floor(Date.now() / 1000); // 当前时间戳（秒）
                const startTime = currentTime - (timeRangeMinutes * 60); // 指定分钟前的时间戳
                whereClause += ` AND transaction_time >= ${startTime}`;
            }

            // 根据排序字段确定ORDER BY子句
            let orderBy: string;
            switch (sortBy) {
                case 'amount':
                    orderBy = 'total_buy_amount DESC';
                    break;
                case 'count':
                    orderBy = 'buy_count DESC';
                    break;
                default:
                    orderBy = 'latest_buy_time DESC';
            }

            const query = `
        SELECT 
          wallet_address,
          COUNT(*) as buy_count,
          SUM(token_amount) as total_token_amount,
          SUM(usd_amount) as total_buy_amount,
          MAX(transaction_time) as latest_buy_time,
          MIN(transaction_time) as first_buy_time,
          AVG(usd_price) as avg_price
        FROM solana_swap_transactions_token 
        WHERE ${whereClause}
        GROUP BY wallet_address
        ORDER BY ${orderBy}
        LIMIT ${limit}
      `;

            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });

            const rows = await data.json() as Array<{
                wallet_address: string;
                buy_count: number;
                total_token_amount: number;
                total_buy_amount: number;
                latest_buy_time: number;
                first_buy_time: number;
                avg_price: number;
            }>;

            const walletDetails: WalletTokenPurchaseInfo[] = rows.map(row => ({
                walletAddress: row.wallet_address,
                buyCount: row.buy_count,
                totalTokenAmount: row.total_token_amount,
                totalBuyAmount: row.total_buy_amount,
                latestBuyTime: row.latest_buy_time,
                firstBuyTime: row.first_buy_time,
                avgPrice: row.avg_price
            }));


            return walletDetails;

        } catch (error) {
            console.error("Error getting wallet token purchase details:", error);
            return [];
        }
    }


    // select w.token_address,
    //    argMax(usd_price, transaction_time) AS latest_usd_price,
    //    max(transaction_time) AS latest_trade_time from solana_swap_transactions_token w where w.token_address in('73oEKK4xcnt5Ti1UnBTFxo4diprhjC3ZqxBYzsZQPDE') group by w.token_address ;

    static async getMultiTokenPrice(tokenAddresses: string[]): Promise<{ [key: string]: number }> {
        if (tokenAddresses.length === 0) {
            return {};
        }

        const batchSize = 100; // 每批处理100个token地址，避免查询语句过长
        const result: { [key: string]: number } = {};


        // 将数组分批处理
        for (let i = 0; i < tokenAddresses.length; i += batchSize) {
            const batch = tokenAddresses.slice(i, i + batchSize);
            const batchIndex = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(tokenAddresses.length / batchSize);

            try {
                const data = await clickhouseClient.query({
                    query: `select w.token_address,
       argMax(usd_price, transaction_time) AS latest_usd_price from solana_swap_transactions_token w where w.token_address in('${batch.join("','")}') group by w.token_address`,
                    format: 'JSONEachRow'
                });

                const rows: { token_address: string, latest_usd_price: number }[] = await data.json();

                // 将当前批次的结果合并到总结果中
                for (const row of rows) {
                    result[row.token_address] = row.latest_usd_price;
                }

            } catch (error) {
                console.error(`[getMultiTokenPrice] 第 ${batchIndex} 批查询失败:`, error);
                // 继续处理下一批，不中断整个流程
            }
        }

        console.log(`[getMultiTokenPrice] 查询完成，共获取到 ${Object.keys(result).length} 个token价格`);
        return result;
    }


}

/**
 * 钱包代币购买信息接口
 */
export interface WalletTokenPurchaseInfo {
    walletAddress: string;
    buyCount: number;
    totalTokenAmount: number;
    totalBuyAmount: number;
    latestBuyTime: number;
    firstBuyTime: number;
    avgPrice: number;
}
