import clickhouseClient from "../../constant/config/clickhouse.js";
import { getSmartMoneyAddresses, isSmartMoneyAddress } from "./address_cache";
import { SwapTransactionToken, TokenSwapFilterData, ESwapTradeType } from "../../type/swap";
import { BLACK_LIST_TOKEN } from "../../constant/address_data/black_list";
import { WALLET_BLACKLIST } from "../../constant/address_data/wallet_black_list";
import { MEVBOT_ADDRESSES } from "../../constant/address_data/mev_list";
import { SNAP_SHOT_CONFIG, SOLANA_DEX_BASE_TOKEN } from "../../constant/config";

/**
 * 聪明钱交易数据接口（与SwapTransaction结构一致）
 */
interface SmartMoneyTransaction {
    txHash: string;
    transactionTime: number; // 秒级时间戳
    walletAddress: string;
    tokenAmount: number;
    tokenSymbol: string;
    tokenAddress: string;
    quoteSymbol: string;
    quoteAmount: number;
    quoteAddress: string;
    quotePrice: number;
    usdPrice: number;
    usdAmount: number;
}

/**
 * 聪明钱交易统计信息
 */
interface SmartMoneyTransactionStats {
    totalTransactions: number;
    uniqueWallets: number;
    uniqueTokens: number;
    totalVolumeUSD: number;
    buyTransactions: number;
    sellTransactions: number;
    timeRange: {
        earliest: number;
        latest: number;
    };
}

/**
 * 聪明钱交易数据处理类
 * 基于SolanaBlockDataHandler的逻辑，但操作smart_money_tx表并筛选聪明钱地址
 */
export class SmartMoneyTransactionHandler {

    /**
     * 处理聪明钱交易数据：筛选并插入到smart_money_tx表
     * @param swapTransactions 原始交易数据数组
     * @returns Promise<number> 成功插入的记录数量
     */
    static async handleSmartMoneyTransactions(swapTransactions: SmartMoneyTransaction[]): Promise<number> {
        try {
            if (swapTransactions.length === 0) {
                return 0;
            }

            console.log(`🔍 开始筛选聪明钱交易：${swapTransactions.length} 条原始交易`);

            // 筛选出聪明钱相关的交易
            const smartMoneyTxs = await this.filterSmartMoneyTransactions(swapTransactions);

            if (smartMoneyTxs.length === 0) {
                console.log("📭 没有找到聪明钱相关的交易");
                return 0;
            }

            // 插入到smart_money_tx表
            await this.insertToSmartMoneyTxTable(smartMoneyTxs);

            console.log(`🎯 成功处理聪明钱交易：${smartMoneyTxs.length}/${swapTransactions.length} 条`);
            return smartMoneyTxs.length;

        } catch (error) {
            console.error("❌ 处理聪明钱交易数据失败:", error);
            throw error;
        }
    }

    /**
     * 根据Redis中的聪明钱地址列表筛选交易
     * @param transactions 原始交易数据
     * @returns Promise<SmartMoneyTransaction[]> 筛选后的聪明钱交易
     */
    private static async filterSmartMoneyTransactions(
        transactions: SmartMoneyTransaction[]
    ): Promise<SmartMoneyTransaction[]> {
        try {
            // 获取聪明钱地址列表（从Redis缓存）
            const smartMoneyAddresses = await getSmartMoneyAddresses();
            
            if (smartMoneyAddresses.length === 0) {
                console.log("⚠️ 聪明钱地址列表为空");
                return [];
            }

            const smartMoneySet = new Set(smartMoneyAddresses);
            console.log(`📋 当前聪明钱地址数量: ${smartMoneySet.size}`);

            // 筛选聪明钱相关的交易
            const filteredTransactions = transactions.filter(tx => 
                smartMoneySet.has(tx.walletAddress)
            );

            console.log(`🎯 筛选结果: ${filteredTransactions.length}/${transactions.length} 条交易匹配聪明钱地址`);
            
            return filteredTransactions;

        } catch (error) {
            console.error("❌ 筛选聪明钱交易失败:", error);
            return [];
        }
    }

    /**
     * 插入数据到smart_money_tx表（类似SolanaBlockDataHandler.insertToTokenTable）
     * @param transactions 聪明钱交易数据
     */
    private static async insertToSmartMoneyTxTable(transactions: SmartMoneyTransaction[]): Promise<void> {
        if (transactions.length === 0) return;

        try {
            const values = transactions.map((tx) => ({
                tx_hash: tx.txHash,
                trade_type: this.determineTradeType(tx),
                pool_address: "", // 如果有池子地址可以从原数据中获取
                block_height: 0, // 如果需要区块高度，需要从原数据中获取
                transaction_time: tx.transactionTime,
                wallet_address: tx.walletAddress,
                token_amount: tx.tokenAmount,
                token_symbol: tx.tokenSymbol,
                token_address: tx.tokenAddress,
                quote_symbol: tx.quoteSymbol,
                quote_amount: tx.quoteAmount,
                quote_address: tx.quoteAddress,
                quote_price: tx.quotePrice,
                usd_price: tx.usdPrice,
                usd_amount: tx.usdAmount,
            }));

            await clickhouseClient.insert({
                table: "smart_money_tx",
                values,
                format: "JSONEachRow",
            });

            console.log(`✅ 插入 ${values.length} 条记录到 smart_money_tx 表`);

        } catch (error) {
            console.error("❌ 插入smart_money_tx表失败:", error);
            throw error;
        }
    }

    /**
     * 确定交易类型（买入/卖出）
     * @param transaction 交易数据
     * @returns string 交易类型
     */
    private static determineTradeType(transaction: SmartMoneyTransaction): string {
        // 可以根据业务逻辑来判断，这里提供一个基本实现
        // 如果原数据中有明确的交易类型标识，可以直接使用
        return "BUY"; // 或者基于其他逻辑判断
    }

    /**
     * 根据时间范围查询聪明钱交易数据（类似SolanaBlockDataHandler.getXDaysData）
     * @param timestamp 时间戳
     * @param limit 限制条数
     * @returns Promise<SwapTransactionToken[]> 查询结果
     */
    static async getXDaysData(timestamp: number, limit = 0): Promise<SwapTransactionToken[]> {
        try {
            const data = await clickhouseClient.query({
                query: `SELECT * FROM smart_money_tx WHERE transaction_time > ${timestamp} ORDER BY transaction_time asc ${limit > 0 ? `LIMIT ${limit}` : ''}`,
                format: 'JSONEachRow'
            });

            const rows = await data.json();
            return rows as SwapTransactionToken[];
        } catch (error) {
            console.error("❌ 查询聪明钱交易数据失败:", error);
            return [];
        }
    }

    /**
     * 根据时间范围查询聪明钱交易数据（类似SolanaBlockDataHandler.getXDaysDataByTimestamp）
     * @param startTimestamp 开始时间戳
     * @param endTimestamp 结束时间戳
     * @param pageNum 页码
     * @param pageSize 页大小
     * @returns Promise<SwapTransactionToken[]> 查询结果
     */
    static async getXDaysDataByTimestamp(
        startTimestamp: number,
        endTimestamp: number,
        pageNum: number,
        pageSize: number
    ): Promise<SwapTransactionToken[]> {
        try {
            const data = await clickhouseClient.query({
                query: `SELECT * FROM smart_money_tx WHERE transaction_time > ${startTimestamp} AND transaction_time < ${endTimestamp} ORDER BY transaction_time DESC LIMIT ${pageNum * pageSize},${pageSize}`,
                format: 'JSONEachRow'
            });

            const rows = await data.json();
            return rows as SwapTransactionToken[];
        } catch (error) {
            console.error("❌ 分页查询聪明钱交易数据失败:", error);
            return [];
        }
    }

    /**
     * 基于区块高度范围获取聪明钱交易数据（类似SolanaBlockDataHandler.getDataByBlockHeightRange）
     * @param startBlockHeight 起始区块高度
     * @param endBlockHeight 结束区块高度
     * @returns Promise<SwapTransactionToken[]>
     */
    static async getDataByBlockHeightRange(startBlockHeight: number, endBlockHeight: number): Promise<SwapTransactionToken[]> {
        try {
            const data = await clickhouseClient.query({
                query: `SELECT * FROM smart_money_tx WHERE block_height >= ${startBlockHeight} AND block_height <= ${endBlockHeight} ORDER BY block_height ASC`,
                format: 'JSONEachRow'
            });

            const rows = await data.json();
            return rows as SwapTransactionToken[];
        } catch (error) {
            console.error("❌ 按区块高度查询聪明钱交易数据失败:", error);
            return [];
        }
    }

    /**
     * 获取指定时间范围的聪明钱交易数据
     * @param startTimestamp 开始时间戳
     * @param endTimestamp 结束时间戳
     * @param limit 限制数量
     */
    static async getSmartMoneyTransactionsByTimeRange(
        startTimestamp: number,
        endTimestamp: number,
        limit: number = 1000
    ): Promise<SwapTransactionToken[]> {
        try {
            const query = `
                SELECT * FROM smart_money_tx 
                WHERE transaction_time >= ${startTimestamp} AND transaction_time <= ${endTimestamp}
                ORDER BY transaction_time DESC
                ${limit > 0 ? `LIMIT ${limit}` : ''}
            `;
            
            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });
            
            const rows = await data.json();
            return rows as SwapTransactionToken[];
        } catch (error) {
            console.error("查询聪明钱交易数据失败:", error);
            throw error;
        }
    }

    /**
     * 获取指定区块高度范围的聪明钱交易数据
     * @param startBlockHeight 起始区块高度
     * @param endBlockHeight 结束区块高度
     */
    static async getSmartMoneyTransactionsByBlockHeightRange(
        startBlockHeight: number,
        endBlockHeight: number
    ): Promise<SwapTransactionToken[]> {
        try {
            const query = `
                SELECT * FROM smart_money_tx 
                WHERE block_height >= ${startBlockHeight} AND block_height <= ${endBlockHeight}
                ORDER BY block_height ASC
            `;
            
            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });
            
            const rows = await data.json();
            return rows as SwapTransactionToken[];
        } catch (error) {
            console.error("按区块高度查询聪明钱交易数据失败:", error);
            throw error;
        }
    }

    /**
     * 获取特定聪明钱地址的交易记录
     * @param walletAddress 钱包地址
     * @param startTimestamp 开始时间戳（可选）
     * @param endTimestamp 结束时间戳（可选）
     * @param limit 限制数量
     */
    static async getTransactionsByWallet(
        walletAddress: string,
        startTimestamp?: number,
        endTimestamp?: number,
        limit: number = 100
    ): Promise<SwapTransactionToken[]> {
        try {
            // 首先验证地址是否为聪明钱
            const isSmart = await isSmartMoneyAddress(walletAddress);
            if (!isSmart) {
                console.warn(`地址 ${walletAddress} 不是聪明钱地址`);
                return [];
            }
            
            let timeCondition = '';
            if (startTimestamp && endTimestamp) {
                timeCondition = `AND transaction_time >= ${startTimestamp} AND transaction_time <= ${endTimestamp}`;
            } else if (startTimestamp) {
                timeCondition = `AND transaction_time >= ${startTimestamp}`;
            } else if (endTimestamp) {
                timeCondition = `AND transaction_time <= ${endTimestamp}`;
            }
            
            const query = `
                SELECT * FROM smart_money_tx 
                WHERE wallet_address = '${walletAddress}' ${timeCondition}
                ORDER BY transaction_time DESC
                LIMIT ${limit}
            `;
            
            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });
            
            const rows = await data.json();
            return rows as SwapTransactionToken[];
        } catch (error) {
            console.error("查询钱包交易记录失败:", error);
            throw error;
        }
    }

    /**
     * 获取聪明钱交易统计信息
     * @param startTimestamp 开始时间戳
     * @param endTimestamp 结束时间戳
     */
    static async getSmartMoneyTransactionStats(
        startTimestamp: number,
        endTimestamp: number
    ): Promise<SmartMoneyTransactionStats> {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_transactions,
                    COUNT(DISTINCT wallet_address) as unique_wallets,
                    COUNT(DISTINCT token_address) as unique_tokens,
                    SUM(usd_amount) as total_volume_usd,
                    SUM(CASE WHEN trade_type = 'BUY' THEN 1 ELSE 0 END) as buy_transactions,
                    SUM(CASE WHEN trade_type = 'SELL' THEN 1 ELSE 0 END) as sell_transactions,
                    MIN(transaction_time) as earliest_time,
                    MAX(transaction_time) as latest_time
                FROM smart_money_tx
                WHERE transaction_time >= ${startTimestamp} AND transaction_time <= ${endTimestamp}
            `;
            
            const data = await clickhouseClient.query({
                query: statsQuery,
                format: 'JSONEachRow'
            });
            
            const rows = await data.json();
            const stats = rows[0] as {
                total_transactions: number;
                unique_wallets: number;
                unique_tokens: number;
                total_volume_usd: number;
                buy_transactions: number;
                sell_transactions: number;
                earliest_time: number;
                latest_time: number;
            };
            
            return {
                totalTransactions: stats.total_transactions || 0,
                uniqueWallets: stats.unique_wallets || 0,
                uniqueTokens: stats.unique_tokens || 0,
                totalVolumeUSD: stats.total_volume_usd || 0,
                buyTransactions: stats.buy_transactions || 0,
                sellTransactions: stats.sell_transactions || 0,
                timeRange: {
                    earliest: stats.earliest_time || startTimestamp,
                    latest: stats.latest_time || endTimestamp
                }
            };
        } catch (error) {
            console.error("获取聪明钱交易统计失败:", error);
            throw error;
        }
    }

    /**
     * 获取聪明钱交易的热门代币排行
     * @param startTimestamp 开始时间戳
     * @param endTimestamp 结束时间戳
     * @param limit 限制数量
     */
    static async getTopTokensBySmartMoney(
        startTimestamp: number,
        endTimestamp: number,
        limit: number = 20
    ): Promise<Array<{
        tokenAddress: string;
        tokenSymbol: string;
        totalTransactions: number;
        totalVolumeUSD: number;
        uniqueWallets: number;
        buyCount: number;
        sellCount: number;
    }>> {
        try {
            const query = `
                SELECT 
                    token_address,
                    token_symbol,
                    COUNT(*) as total_transactions,
                    SUM(usd_amount) as total_volume_usd,
                    COUNT(DISTINCT wallet_address) as unique_wallets,
                    SUM(CASE WHEN trade_type = 'BUY' THEN 1 ELSE 0 END) as buy_count,
                    SUM(CASE WHEN trade_type = 'SELL' THEN 1 ELSE 0 END) as sell_count
                FROM smart_money_tx
                WHERE transaction_time >= ${startTimestamp} AND transaction_time <= ${endTimestamp}
                GROUP BY token_address, token_symbol
                ORDER BY total_volume_usd DESC
                LIMIT ${limit}
            `;
            
            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });
            
            const rows = await data.json();
            return rows.map((row: any) => ({
                tokenAddress: row.token_address,
                tokenSymbol: row.token_symbol,
                totalTransactions: row.total_transactions,
                totalVolumeUSD: row.total_volume_usd,
                uniqueWallets: row.unique_wallets,
                buyCount: row.buy_count,
                sellCount: row.sell_count
            }));
        } catch (error) {
            console.error("获取热门代币排行失败:", error);
            throw error;
        }
    }

    /**
     * 过滤聪明钱交易数据（类似SolanaBlockDataHandler的过滤逻辑）
     * @param data 原始交易数据
     * @returns 过滤后的交易数据
     */
    static async filterSmartMoneyTransactionData(data: SwapTransactionToken[]): Promise<TokenSwapFilterData[]> {
        try {
            const result: TokenSwapFilterData[] = [];
            const smartMoneyAddresses = await getSmartMoneyAddresses();
            const smartMoneySet = new Set(smartMoneyAddresses);

            for (const transaction of data) {
                // 1. 检查是否为聪明钱地址
                if (!smartMoneySet.has(transaction.wallet_address)) {
                    continue;
                }

                // 2. 应用原有的过滤逻辑
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
                    usdPrice: transaction.usd_price,
                    usdAmount: calculatedUsdAmount,
                    transactionTime: transactionTime,
                    tokenAmount: transaction.token_amount,
                    quoteAmount: transaction.quote_amount,
                };

                result.push(filteredData);
            }

            return result;
        } catch (error) {
            console.error("过滤聪明钱交易数据失败:", error);
            throw error;
        }
    }

    /**
     * 删除指定时间范围的聪明钱交易数据
     * @param startTimestamp 开始时间戳
     * @param endTimestamp 结束时间戳
     */
    static async deleteSmartMoneyTransactionsByTimeRange(
        startTimestamp: number,
        endTimestamp: number
    ): Promise<void> {
        try {
            const query = `
                ALTER TABLE smart_money_tx 
                DELETE WHERE transaction_time >= ${startTimestamp} AND transaction_time <= ${endTimestamp}
            `;
            
            await clickhouseClient.query({
                query
            });
            
            console.log(`✅ 删除时间范围 ${startTimestamp} - ${endTimestamp} 的聪明钱交易数据`);
        } catch (error) {
            console.error("删除聪明钱交易数据失败:", error);
            throw error;
        }
    }
}

/**
 * 便捷方法：处理原始交易数据并插入聪明钱交易表
 * @param transactions 原始交易数据
 * @returns Promise<number> 插入的记录数
 */
export async function processSmartMoneyTransactions(transactions: SmartMoneyTransaction[]): Promise<number> {
    return await SmartMoneyTransactionHandler.handleSmartMoneyTransactions(transactions);
}
