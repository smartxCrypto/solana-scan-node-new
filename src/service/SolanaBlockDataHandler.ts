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
import { commonInsert } from "@/utils/mysqlHelper";
import { getTokenInfoUseCache } from "@/service/TokenInfoService";

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
    private static lpinfo_cache = `LP_INFO_CACHE_KEY`;
    public static async start() {
        while (!this.stopped) {
            try {
                const keys = await redisClient.hkeys(BlockDataSerializer.cache_key);
                if (keys.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    continue;
                }
                const sortedBlockNumbers = keys.map((key: string) => Number(key)).sort((a: number, b: number) => a - b);
                // const batchSize = 1;
                // for (let i = 0; i < sortedBlockNumbers.length; i += batchSize) {
                //     const batch = sortedBlockNumbers.slice(i, i + batchSize);
                //     console.log("batchHandle:", batch);
                //     await Promise.all(batch.map(async (blockNumber: number) => {
                //         const lockKey = `handle_block_data_lock:${blockNumber}`;
                //         try {
                //             const getLock = await redisClient.setNX(lockKey, "1");
                //             if (getLock > 0) {
                //                 await SolanaBlockDataHandler.handleBlockData(blockNumber);
                //             } else {
                //                 console.log(`other process is handling,blockNumber:${blockNumber}`);
                //             }
                //         } catch (e) {
                //             console.log(`SolanaBlockDataHandler.handleBlockData error,blockNumber:${blockNumber}`, e);
                //         } finally {
                //             redisClient.del(lockKey);
                //         }
                //     }));
                // }
                for (let i = 0; i < sortedBlockNumbers.length; i++) {
                    const blockNumber = sortedBlockNumbers[i];
                    const lockKey = `handle_block_data_lock:${blockNumber}`;
                    try {
                        const getLock = await redisClient.setNX(lockKey, "1");
                        if (getLock > 0) {
                            try {
                                await SolanaBlockDataHandler.handleBlockData(blockNumber);
                            } finally {
                                await redisClient.hdel(BlockDataSerializer.cache_key, String(blockNumber));
                                const hasDelete = await redisClient.client.hExists(BlockDataSerializer.cache_key, String(blockNumber));
                                if (hasDelete === 0) {
                                    await redisClient.del(lockKey);
                                }
                            }
                        } else {
                            // console.log(`other process is handling,blockNumber:${blockNumber}`);
                        }
                    } catch (e) {
                        console.log(`SolanaBlockDataHandler.handleBlockData error,blockNumber:${blockNumber}`, e);
                    }
                }
            } catch (e) {
                console.log(`SolanaBlockDataHandler.start error`, e);
            }
        }
    }

    public static stop() {
        this.stopped = true;
        console.log(`[SolanaBlockDataHandler] 实例 ${process.pid} 设置停止标志`);
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
            this.insertToTokenTable(swapTransactionArray);
            this.insertToWalletTable(swapTransactionArray);
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
        this.convertToLpInfoUpdateList(fileteTransactions, Number(blockData.blockTime?.timestamp), tokenPriceMap);
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
            table: "≈",
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
        const values: any[] = [];
        const placeholders: string[] = [];

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

            placeholders.push("(?, ?, ?, ?, ?, ?, ?,?,?)");
            let liquidityUsdValue = MathUtil.multiply(quote_amount, 1);
            if (quoteSymbol === "SOL" || quoteSymbol === "WSOL") {
                liquidityUsdValue = MathUtil.multiply(quote_amount, solUsdPrice);
            }
            liquidityUsdValue = MathUtil.multiply(liquidityUsdValue, 2);
            console.log(`pool${lp.pool_address}  liquidityUsdValue:${liquidityUsdValue}`)
            values.push(
                lp.pool_address,
                tokenAddress,
                token_amount.toString(),
                quoteAddress,
                quote_amount.toString(),
                quoteSymbol,
                liquidityUsdValue,
                lp.fee_rate || 0,
                lp.transactinTimeTs
            );
        }

        const sql = `
            INSERT INTO lp_info (pool_address, token_address, token_amount, quote_address, quote_amount, quote_symbol,
                                 liquidity_usd, fee_rate,last_transaction_time)
            VALUES ${placeholders.join(",")} ON DUPLICATE KEY
            UPDATE
                token_amount =
            VALUES (token_amount), quote_amount =
            VALUES (quote_amount), liquidity_usd =
            VALUES (liquidity_usd), fee_rate =
            VALUES (fee_rate)
        `;

        try {
            await commonInsert(sql, values);
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
                transactionTime: transaction.transaction_time,
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
