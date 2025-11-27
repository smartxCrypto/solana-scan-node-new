import clickhouseClient from "../constant/config/clickhouse.js";
import { TokenSnapshotRepository } from "../database/repositories";

/**
 * 时间维度枚举
 */
export enum TimeWindow {
    FIVE_MINUTES = "5M",
    FIFTEEN_MINUTES = "15M",
    ONE_HOUR = "1H",
    TWENTY_FOUR_HOURS = "24H"
}

/**
 * 代币分析结果接口
 */
export interface TokenAnalyticsResult {
    tokenAddress: string;
    tokenSymbol: string;
    timeWindow: TimeWindow;
    volume: number;              // 交易量
    marketcap: number;           // 市值
    smLastTx: number;            // 最后一次聪明钱交易时间
    realizedPnl: number;         // 聪明钱总PnL
    smartVolume: number;         // 聪明钱交易额
    smHolding: number;           // 聪明钱持仓数量
    smHolder: number;            // 依然持仓的聪明钱holder数量
    calculatedAt: number;        // 计算时间戳
}

/**
 * 代币快照信息接口
 */
interface TokenSnapshot {
    snap_shot_block_time: number;
    buy_amount: number;
    sell_amount: number;
    avg_price: number;
    total_supply: number;
}

/**
 * 代币分析服务类
 */
export class TokenAnalyticsService {

    /**
     * 获取时间窗口对应的秒数
     * @param timeWindow 时间维度
     * @returns 秒数
     */
    private static getTimeWindowSeconds(timeWindow: TimeWindow): number {
        switch (timeWindow) {
            case TimeWindow.FIVE_MINUTES:
                return 5 * 60;
            case TimeWindow.FIFTEEN_MINUTES:
                return 15 * 60;
            case TimeWindow.ONE_HOUR:
                return 60 * 60;
            case TimeWindow.TWENTY_FOUR_HOURS:
                return 24 * 60 * 60;
            default:
                return 60 * 60; // 默认1小时
        }
    }

    /**
     * 分析代币指标
     * @param tokenAddress 代币地址
     * @param timeWindow 时间维度
     * @returns Promise<TokenAnalyticsResult> 分析结果
     */
    static async analyzeToken(
        tokenAddress: string,
        timeWindow: TimeWindow
    ): Promise<TokenAnalyticsResult> {
        try {

            const currentTime = Math.floor(Date.now() / 1000);
            const windowSeconds = this.getTimeWindowSeconds(timeWindow);
            const windowStartTime = currentTime - windowSeconds;

            // 并行计算所有指标
            const [
                { volume, marketcap, tokenSymbol },
                smLastTx,
                realizedPnl,
                smartVolume,
                smHolding,
                smHolder
            ] = await Promise.all([
                this.calculateVolumeAndMarketcap(tokenAddress),
                this.getSmartMoneyLastTransactionTime(tokenAddress),
                this.calculateRealizedPnl(tokenAddress),
                this.calculateSmartVolume(tokenAddress, windowStartTime),
                this.calculateSmartMoneyHolding(tokenAddress),
                this.calculateSmartMoneyHolderCount(tokenAddress)
            ]);

            const result: TokenAnalyticsResult = {
                tokenAddress,
                tokenSymbol,
                timeWindow,
                volume,
                marketcap,
                smLastTx,
                realizedPnl,
                smartVolume,
                smHolding,
                smHolder,
                calculatedAt: currentTime
            };

            return result;

        } catch (error) {
            throw error;
        }
    }

    /**
     * 计算交易量和市值
     * @param tokenAddress 代币地址
     * @returns Promise<{volume: number, marketcap: number, tokenSymbol: string}>
     */
    private static async calculateVolumeAndMarketcap(tokenAddress: string): Promise<{
        volume: number;
        marketcap: number;
        tokenSymbol: string;
    }> {
        try {
            // 1. 获取最新的快照信息
            const latestSnapshot = await this.getLatestTokenSnapshot(tokenAddress);

            if (!latestSnapshot) {
                return { volume: 0, marketcap: 0, tokenSymbol: '' };
            }

            // 2. 计算快照中的交易量
            const lastSnapShotVolume = (latestSnapshot.buy_amount + latestSnapshot.sell_amount) * latestSnapshot.avg_price;

            // 3. 计算快照时间之后的交易量
            const withoutSsVolumeQuery = `
                SELECT SUM(token_amount * usd_price) as volume_after_snapshot
                FROM solana_swap_transactions_wallet 
                WHERE token_address = '${tokenAddress}' 
                  AND transaction_time > ${latestSnapshot.snap_shot_block_time}
            `;

            const volumeData = await clickhouseClient.query({
                query: withoutSsVolumeQuery,
                format: 'JSONEachRow'
            });

            const volumeRows = await volumeData.json() as any[];
            const volumeResult = volumeRows.length > 0 ? volumeRows[0] : {};
            const withoutSsVolume = parseFloat(volumeResult.volume_after_snapshot || '0') || 0;

            // 4. 总交易量
            const totalVolume = lastSnapShotVolume + withoutSsVolume;

            // 5. 获取当前代币价格
            const currentPrice = await this.getCurrentTokenPrice(tokenAddress);

            // 6. 计算市值
            const marketcap = latestSnapshot.total_supply * currentPrice;

            // 7. 获取代币符号
            const tokenSymbol = await this.getTokenSymbol(tokenAddress);

            return {
                volume: totalVolume,
                marketcap,
                tokenSymbol
            };

        } catch (error) {
            return { volume: 0, marketcap: 0, tokenSymbol: '' };
        }
    }

    /**
     * 获取最新的代币快照
     * @param tokenAddress 代币地址
     * @returns Promise<TokenSnapshot | null>
     */
    private static async getLatestTokenSnapshot(tokenAddress: string): Promise<TokenSnapshot | null> {
        try {
            const snapshot = await TokenSnapshotRepository.findLatestByToken(tokenAddress);

            if (!snapshot) {
                return null;
            }

            return {
                snap_shot_block_time: Number(snapshot.snapShotBlockTime),
                buy_amount: snapshot.buyAmount,
                sell_amount: snapshot.sellAmount,
                avg_price: snapshot.avgPrice,
                total_supply: snapshot.totalSupply
            };

        } catch (error) {
            return null;
        }
    }

    /**
     * 获取当前代币价格
     * @param tokenAddress 代币地址
     * @returns Promise<number>
     */
    private static async getCurrentTokenPrice(tokenAddress: string): Promise<number> {
        try {
            const priceQuery = `
                SELECT usd_price 
                FROM solana_swap_transactions_token 
                WHERE token_address = '${tokenAddress}' 
                ORDER BY transaction_time DESC 
                LIMIT 1
            `;

            const priceData = await clickhouseClient.query({
                query: priceQuery,
                format: 'JSONEachRow'
            });

            const priceRows = await priceData.json() as any[];
            const priceResult = priceRows.length > 0 ? priceRows[0] : {};
            return parseFloat(priceResult.usd_price || '0') || 0;

        } catch (error) {
            return 0;
        }
    }

    /**
     * 获取代币符号
     * @param tokenAddress 代币地址
     * @returns Promise<string>
     */
    private static async getTokenSymbol(tokenAddress: string): Promise<string> {
        try {
            const symbolQuery = `
                SELECT token_symbol 
                FROM solana_swap_transactions_token 
                WHERE token_address = '${tokenAddress}' 
                LIMIT 1
            `;

            const symbolData = await clickhouseClient.query({
                query: symbolQuery,
                format: 'JSONEachRow'
            });

            const symbolRows = await symbolData.json() as any[];
            const symbolResult = symbolRows.length > 0 ? symbolRows[0] : {};
            return symbolResult.token_symbol || '';

        } catch (error) {
            return '';
        }
    }

    /**
     * 获取聪明钱最后一次交易时间
     * @param tokenAddress 代币地址
     * @returns Promise<number>
     */
    private static async getSmartMoneyLastTransactionTime(tokenAddress: string): Promise<number> {
        try {
            const query = `
                SELECT MAX(transaction_time) as last_tx_time
                FROM smart_money_tx 
                WHERE token_address = '${tokenAddress}'
            `;

            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });

            const rows = await data.json() as any[];
            const result = rows.length > 0 ? rows[0] : {};
            return parseInt(result.last_tx_time || '0') || 0;

        } catch (error) {
            return 0;
        }
    }

    /**
     * 计算聪明钱总PnL
     * @param tokenAddress 代币地址
     * @returns Promise<number>
     */
    private static async calculateRealizedPnl(tokenAddress: string): Promise<number> {
        try {
            const query = `
                SELECT 
                    SUM(CASE WHEN trade_type = 'SELL' THEN usd_amount ELSE 0 END) as total_sell_usd,
                    SUM(CASE WHEN trade_type = 'BUY' THEN usd_amount ELSE 0 END) as total_buy_usd
                FROM smart_money_tx 
                WHERE token_address = '${tokenAddress}'
            `;

            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });

            const rows = await data.json() as any[];
            const result = rows.length > 0 ? rows[0] : {};
            const totalSellUsd = parseFloat(result.total_sell_usd || '0') || 0;
            const totalBuyUsd = parseFloat(result.total_buy_usd || '0') || 0;

            // PnL = 卖出总额 - 买入总额
            return totalSellUsd - totalBuyUsd;

        } catch (error) {
            return 0;
        }
    }

    /**
     * 计算指定时间窗口内的聪明钱交易额
     * @param tokenAddress 代币地址
     * @param windowStartTime 时间窗口开始时间
     * @returns Promise<number>
     */
    private static async calculateSmartVolume(tokenAddress: string, windowStartTime: number): Promise<number> {
        try {
            const query = `
                SELECT SUM(usd_price * token_amount) as smart_volume
                FROM smart_money_tx 
                WHERE token_address = '${tokenAddress}' 
                  AND transaction_time > ${windowStartTime}
            `;

            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });

            const rows = await data.json() as any[];
            const result = rows.length > 0 ? rows[0] : {};
            return parseFloat(result.smart_volume || '0') || 0;

        } catch (error) {
            return 0;
        }
    }

    /**
     * 计算聪明钱总持仓数量
     * @param tokenAddress 代币地址
     * @returns Promise<number>
     */
    private static async calculateSmartMoneyHolding(tokenAddress: string): Promise<number> {
        try {
            const query = `
                SELECT 
                    SUM(
                        CASE 
                            WHEN trade_type = 'BUY' THEN token_amount
                            WHEN trade_type = 'SELL' THEN -token_amount
                            ELSE 0
                        END
                    ) AS sm_holding
                FROM smart_money_tx
                WHERE token_address = '${tokenAddress}'
            `;

            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });

            const rows = await data.json() as any[];
            const result = rows.length > 0 ? rows[0] : {};
            return parseFloat(result.sm_holding || '0') || 0;

        } catch (error) {
            return 0;
        }
    }

    /**
     * 计算依然持仓的聪明钱holder数量
     * @param tokenAddress 代币地址
     * @returns Promise<number>
     */
    private static async calculateSmartMoneyHolderCount(tokenAddress: string): Promise<number> {
        try {
            const query = `
                SELECT 
                    COUNT(*) as holder_count
                FROM (
                    SELECT 
                        wallet_address,
                        SUM(
                            CASE 
                                WHEN trade_type = 'BUY' THEN token_amount
                                WHEN trade_type = 'SELL' THEN -token_amount
                                ELSE 0
                            END
                        ) AS net_token_balance
                    FROM smart_money_tx
                    WHERE token_address = '${tokenAddress}' 
                    GROUP BY wallet_address
                    HAVING net_token_balance > 0
                ) AS token_holders
            `;

            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });

            const rows = await data.json() as any[];
            const result = rows.length > 0 ? rows[0] : {};
            return parseInt(result.holder_count || '0') || 0;

        } catch (error) {
            return 0;
        }
    }

    /**
     * 批量分析多个代币
     * @param tokenAddresses 代币地址数组
     * @param timeWindow 时间维度
     * @returns Promise<TokenAnalyticsResult[]>
     */
    static async batchAnalyzeTokens(
        tokenAddresses: string[],
        timeWindow: TimeWindow
    ): Promise<TokenAnalyticsResult[]> {
        try {

            const results: TokenAnalyticsResult[] = [];
            const batchSize = 10; // 每批处理10个代币

            for (let i = 0; i < tokenAddresses.length; i += batchSize) {
                const batch = tokenAddresses.slice(i, i + batchSize);

                const batchResults = await Promise.all(
                    batch.map(tokenAddress =>
                        this.analyzeToken(tokenAddress, timeWindow)
                            .catch(error => {
                                return null;
                            })
                    )
                );

                // 过滤掉失败的结果
                results.push(...batchResults.filter(result => result !== null) as TokenAnalyticsResult[]);

                // 添加小延迟防止过载
                if (i + batchSize < tokenAddresses.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            return results;

        } catch (error) {
            return [];
        }
    }

    /**
     * 获取热门聪明钱代币排行榜
     * @param timeWindow 时间维度
     * @param limit 限制数量
     * @returns Promise<TokenAnalyticsResult[]>
     */
    static async getTopSmartMoneyTokens(
        timeWindow: TimeWindow,
        limit: number = 50
    ): Promise<TokenAnalyticsResult[]> {
        try {
            const windowSeconds = this.getTimeWindowSeconds(timeWindow);
            const windowStartTime = Math.floor(Date.now() / 1000) - windowSeconds;

            // 获取该时间窗口内交易量最大的代币
            const query = `
                SELECT 
                    token_address,
                    token_symbol,
                    SUM(usd_price * token_amount) as smart_volume
                FROM smart_money_tx 
                WHERE transaction_time > ${windowStartTime}
                GROUP BY token_address, token_symbol
                ORDER BY smart_volume DESC
                LIMIT ${limit}
            `;

            const data = await clickhouseClient.query({
                query,
                format: 'JSONEachRow'
            });

            const rows = await data.json();
            const topTokenAddresses = rows.map((row: any) => row.token_address);

            // 批量分析这些热门代币
            return await this.batchAnalyzeTokens(topTokenAddresses, timeWindow);

        } catch (error) {
            return [];
        }
    }
}

/**
 * 便捷方法：分析单个代币
 * @param tokenAddress 代币地址
 * @param timeWindow 时间维度
 * @returns Promise<TokenAnalyticsResult>
 */
export async function analyzeToken(
    tokenAddress: string,
    timeWindow: TimeWindow = TimeWindow.ONE_HOUR
): Promise<TokenAnalyticsResult> {
    return await TokenAnalyticsService.analyzeToken(tokenAddress, timeWindow);
}

/**
 * 便捷方法：获取热门聪明钱代币
 * @param timeWindow 时间维度
 * @param limit 限制数量
 * @returns Promise<TokenAnalyticsResult[]>
 */
export async function getTopSmartMoneyTokens(
    timeWindow: TimeWindow = TimeWindow.ONE_HOUR,
    limit: number = 20
): Promise<TokenAnalyticsResult[]> {
    return await TokenAnalyticsService.getTopSmartMoneyTokens(timeWindow, limit);
}
