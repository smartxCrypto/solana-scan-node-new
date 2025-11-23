
import { commonQuery, commonInsert, commonUpdate, commonDelete } from "../../utils/mysqlHelper";

// 聪明钱地址数据库操作接口
export interface SmartMoneyAddressRecord {
    id?: number;
    address: string;
    category: string;
    category_score: number;
    mark_name: string;
    last_analysis_time: Date;
    created_at?: Date;
    updated_at?: Date;
}

// 活跃钱包统计信息
export interface ActiveWalletStats {
    walletAddress: string;
    totalTransactions: number;
    totalBuyCount: number;
    totalSellCount: number;
    uniqueTokens: number;
    totalBuyVolume: number;
    totalSellVolume: number;
    firstActivityTime: Date;
    lastActivityTime: Date;
    pnlSol: number;
    pnlUsd: number;
    winCount: number;
    loseCount: number;
}

/**
 * 聪明钱地址数据库操作类
 */
export class SmartMoneyAddressService {

    /**
     * 获取所有已存在的聪明钱地址
     */
    static async getAllSmartMoneyAddresses(): Promise<string[]> {
        try {
            const result = await commonQuery<{ address: string }>("SELECT address FROM smart_money_address");
            return result.map(row => row.address) || [];
        } catch (error) {
            console.error("获取聪明钱地址列表失败:", error);
            return [];
        }
    }

    /**
     * 获取过去指定天数内的活跃钱包地址（排除已知聪明钱地址）
     * 优化版本：分步骤处理，避免复杂JOIN
     * @param days 过去天数
     * @param minTransactionCount 最低交易次数
     * @param minBuyCount 最低买入次数
     * @param minTokenCount 最低交易代币种类数
     */
    static async getActiveWalletsExcludingSmartMoney(
        days: number = 1,  // 改为默认1天，每天执行一次
        minTransactionCount: number = 5,  // 降低门槛
        minBuyCount: number = 2,
        minTokenCount: number = 1
    ): Promise<string[]> {
        try {
            const smartMoneyAddresses = await this.getAllSmartMoneyAddresses();
            const smartMoneySet = new Set(smartMoneyAddresses);

            const cutoffTime = new Date();
            cutoffTime.setDate(cutoffTime.getDate() - days);
            const cutoffTimeStr = cutoffTime.toISOString().slice(0, 19).replace('T', ' ');

            const activeWalletsSql = `
                SELECT DISTINCT wallet_address 
                FROM wallet_trading_ss 
                WHERE created_at >= ?
            `;

            const activeResult = await commonQuery<{ wallet_address: string }>(activeWalletsSql, [cutoffTimeStr]);
            const allActiveWallets = activeResult;

            console.log("activeResult", activeResult.length);

            // 步骤3: 在内存中排除聪明钱地址
            const candidateWallets = allActiveWallets.filter(address => !smartMoneySet.has(address?.wallet_address || ''));

            console.log("candidateWallets", candidateWallets.length);


            // 步骤4: 如果候选钱包太多，进行进一步筛选

            return candidateWallets.map(address => address.wallet_address);

        } catch (error) {
            console.error("获取活跃钱包地址失败:", error);
            return [];
        }
    }

    /**
     * 根据活跃度筛选钱包地址
     * @param walletAddresses 候选钱包地址列表
     * @param days 天数
     * @param minTransactionCount 最低交易次数
     * @param minBuyCount 最低买入次数
     * @param minTokenCount 最低交易代币种类数
     */
    private static async filterWalletsByActivity(
        walletAddresses: string[],
        days: number,
        minTransactionCount: number,
        minBuyCount: number,
        minTokenCount: number
    ): Promise<string[]> {
        if (walletAddresses.length === 0) return [];

        try {
            const cutoffTime = new Date();
            cutoffTime.setDate(cutoffTime.getDate() - days);
            const cutoffTimeStr = cutoffTime.toISOString().slice(0, 19).replace('T', ' ');

            // 分批处理，避免IN子句过长
            const batchSize = 1000;
            const qualifiedWallets: string[] = [];

            for (let i = 0; i < walletAddresses.length; i += batchSize) {
                const batch = walletAddresses.slice(i, i + batchSize);
                const placeholders = batch.map(() => '?').join(',');

                const sql = `
                    SELECT 
                        w.wallet_address,
                        SUM(w.buy_count + w.sell_count) as total_transactions,
                        SUM(w.buy_count) as total_buy_count,
                        COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(token.value, '$.tokenAddress'))) as unique_tokens
                    FROM wallet_trading_ss w
                    CROSS JOIN JSON_TABLE(w.current_token_value, '$[*]' COLUMNS (
                        value JSON PATH '$'
                    )) AS token
                    WHERE w.snapshot_time >= ?
                      AND w.wallet_address IN (${placeholders})
                    GROUP BY w.wallet_address
                    HAVING total_transactions >= ? 
                       AND total_buy_count >= ?
                       AND unique_tokens >= ?
                `;

                const params = [cutoffTimeStr, ...batch, minTransactionCount, minBuyCount, minTokenCount];
                const result = await commonQuery<any>(sql, params);

                const batchQualified = result.map(row => row.wallet_address as string) || [];
                qualifiedWallets.push(...batchQualified);

                console.log(`📊 批次 ${Math.floor(i / batchSize) + 1}: ${batchQualified.length}/${batch.length} 个钱包符合条件`);
            }

            return qualifiedWallets;

        } catch (error) {
            console.error("筛选钱包活跃度失败:", error);
            return [];
        }
    }

    /**
     * 获取活跃钱包的详细统计信息
     * @param walletAddresses 钱包地址列表
     * @param days 过去天数
     */
    static async getActiveWalletStats(
        walletAddresses: string[],
        days: number = 3
    ): Promise<ActiveWalletStats[]> {
        if (walletAddresses.length === 0) return [];

        try {
            const cutoffTime = new Date();
            cutoffTime.setDate(cutoffTime.getDate() - days);
            const cutoffTimeStr = cutoffTime.toISOString().slice(0, 19).replace('T', ' ');

            const placeholders = walletAddresses.map(() => '?').join(',');

            const sql = `
                SELECT 
                    w.wallet_address,
                    SUM(w.buy_count + w.sell_count) as total_transactions,
                    SUM(w.buy_count) as total_buy_count,
                    SUM(w.sell_count) as total_sell_count,
                    COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(token.value, '$.tokenAddress'))) as unique_tokens,
                    SUM(w.total_buy_sol_amount) as total_buy_volume,
                    SUM(w.total_sell_sol_amount) as total_sell_volume,
                    MIN(w.snapshot_time) as first_activity_time,
                    MAX(w.snapshot_time) as last_activity_time,
                    SUM(w.total_sell_sol_amount - w.total_buy_sol_amount) as pnl_sol,
                    SUM(w.total_sell_usd_amount - w.total_buy_usd_amount) as pnl_usd,
                    MAX(w.win_count) as win_count,
                    MAX(w.lose_count) as lose_count
                FROM wallet_trading_ss w
                CROSS JOIN JSON_TABLE(w.current_token_value, '$[*]' COLUMNS (
                    value JSON PATH '$'
                )) AS token
                WHERE w.snapshot_time >= ?
                  AND w.wallet_address IN (${placeholders})
                GROUP BY w.wallet_address
                ORDER BY pnl_sol DESC
            `;

            const params = [cutoffTimeStr, ...walletAddresses];
            const result: any = await commonQuery(sql, params);

            return result.rows?.map((row: any) => ({
                walletAddress: row.wallet_address as string,
                totalTransactions: row.total_transactions as number,
                totalBuyCount: row.total_buy_count as number,
                totalSellCount: row.total_sell_count as number,
                uniqueTokens: row.unique_tokens as number,
                totalBuyVolume: row.total_buy_volume as number,
                totalSellVolume: row.total_sell_volume as number,
                firstActivityTime: new Date(row.first_activity_time as string),
                lastActivityTime: new Date(row.last_activity_time as string),
                pnlSol: row.pnl_sol as number,
                pnlUsd: row.pnl_usd as number,
                winCount: row.win_count as number,
                loseCount: row.lose_count as number
            })) || [];

        } catch (error) {
            console.error("获取活跃钱包统计信息失败:", error);
            return [];
        }
    }

    /**
     * 检查地址是否已经是聪明钱
     */
    static async isSmartMoneyAddress(address: string): Promise<boolean> {
        try {
            const result = await commonQuery(
                "SELECT COUNT(*) as count FROM smart_money_address WHERE address = ?",
                [address]
            );
            const count = (result as any).rows?.[0]?.count as number;
            return count > 0;
        } catch (error) {
            console.error("检查聪明钱地址失败:", error);
            return false;
        }
    }

    /**
     * 批量检查地址是否已经是聪明钱
     */
    static async filterExistingSmartMoneyAddresses(addresses: string[]): Promise<string[]> {
        if (addresses.length === 0) return [];

        try {
            const placeholders = addresses.map(() => '?').join(',');
            const result = await commonQuery(
                `SELECT address FROM smart_money_address WHERE address IN (${placeholders})`,
                addresses
            );
            return (result as any).rows?.map((row: any) => row[0] as string) || [];
        } catch (error) {
            console.error("批量检查聪明钱地址失败:", error);
            return [];
        }
    }

    /**
     * 获取需要分析的新地址（排除已知聪明钱地址）
     */
    static async getNewAddressesToAnalyze(candidateAddresses: string[]): Promise<string[]> {
        const existingSmartMoneyAddresses = await this.filterExistingSmartMoneyAddresses(candidateAddresses);
        const existingSet = new Set(existingSmartMoneyAddresses);

        const newAddresses = candidateAddresses.filter(address => !existingSet.has(address));

        return newAddresses;
    }

    /**
     * 插入新的聪明钱地址
     */
    static async insertSmartMoneyAddress(record: Omit<SmartMoneyAddressRecord, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
        try {
            await commonInsert(
                `INSERT INTO smart_money_address (address, category, category_score, mark_name, last_analysis_time) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    record.address,
                    record.category,
                    record.category_score,
                    record.mark_name,
                    record.last_analysis_time
                ]
            );
            return true;
        } catch (error) {
            console.error("插入聪明钱地址失败:", error);
            return false;
        }
    }

    /**
     * 批量插入聪明钱地址
     */
    static async batchInsertSmartMoneyAddresses(records: Omit<SmartMoneyAddressRecord, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
        let successCount = 0;

        for (const record of records) {
            const success = await this.insertSmartMoneyAddress(record);
            if (success) successCount++;
        }

        return successCount;
    }

    /**
     * 更新聪明钱地址的分析时间和分类信息
     */
    static async updateSmartMoneyAddress(
        address: string,
        category: string,
        categoryScore: number,
        analysisTime: Date
    ): Promise<boolean> {
        try {
            await commonUpdate(
                `UPDATE smart_money_address 
                 SET category = ?, category_score = ?, last_analysis_time = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE address = ?`,
                [category, categoryScore, analysisTime, address]
            );
            return true;
        } catch (error) {
            console.error("更新聪明钱地址失败:", error);
            return false;
        }
    }

    /**
     * 获取指定分类的聪明钱地址
     */
    static async getSmartMoneyAddressesByCategory(category: string): Promise<SmartMoneyAddressRecord[]> {
        try {
            const result = await commonQuery(
                "SELECT * FROM smart_money_address WHERE category = ? ORDER BY category_score DESC",
                [category]
            );

            return (result as any).rows?.map((row: any) => ({
                id: row.id as number,
                address: row.address as string,
                category: row.category as string,
                category_score: row.category_score as number,
                mark_name: row.mark_name as string,
                last_analysis_time: new Date(row.last_analysis_time as string),
                created_at: new Date(row.created_at as string),
                updated_at: new Date(row.updated_at as string)
            })) || [];
        } catch (error) {
            console.error("获取分类聪明钱地址失败:", error);
            return [];
        }
    }

    /**
     * 获取聪明钱地址统计信息
     */
    static async getSmartMoneyStatistics(): Promise<{
        total: number;
        byCategory: Record<string, number>;
        lastAnalysisTime: Date | null;
    }> {
        try {
            // 获取总数
            const totalResult = await commonQuery("SELECT COUNT(*) as total FROM smart_money_address");
            const total = (totalResult as any).rows?.[0]?.total as number || 0;

            // 按分类统计
            const categoryResult = await commonQuery(
                "SELECT category, COUNT(*) as count FROM smart_money_address GROUP BY category"
            );

            const byCategory: Record<string, number> = {};
            (categoryResult as any).rows?.forEach((row: any) => {
                byCategory[row.category as string] = row.count as number;
            });

            // 最后分析时间
            const timeResult = await commonQuery(
                "SELECT MAX(last_analysis_time) as last_time FROM smart_money_address"
            );
            const lastAnalysisTime = (timeResult as any).rows?.[0]?.last_time ? new Date((timeResult as any).rows[0].last_time as string) : null;

            return {
                total,
                byCategory,
                lastAnalysisTime
            };
        } catch (error) {
            console.error("获取聪明钱统计信息失败:", error);
            return {
                total: 0,
                byCategory: {},
                lastAnalysisTime: null
            };
        }
    }

    /**
     * 获取最近添加的聪明钱地址
     * @param limit 限制数量
     */
    static async getRecentSmartMoneyAddresses(limit: number = 50): Promise<SmartMoneyAddressRecord[]> {
        try {
            const result = await commonQuery(
                "SELECT * FROM smart_money_address ORDER BY created_at DESC LIMIT ?",
                [limit]
            );

            return (result as any).rows?.map((row: any) => ({
                id: row.id as number,
                address: row.address as string,
                category: row.category as string,
                category_score: row.category_score as number,
                mark_name: row.mark_name as string,
                last_analysis_time: new Date(row.last_analysis_time as string),
                created_at: new Date(row.created_at as string),
                updated_at: new Date(row.updated_at as string)
            })) || [];
        } catch (error) {
            console.error("获取最近聪明钱地址失败:", error);
            return [];
        }
    }

    /**
     * 删除过期的聪明钱记录（比如超过30天未更新的）
     */
    static async cleanupOutdatedRecords(daysOld: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await commonDelete(
                "DELETE FROM smart_money_address WHERE last_analysis_time < ?",
                [cutoffDate]
            );

            // 假设删除操作的结果可以通过某种方式获取影响的行数
            // 如果没有rowsAffected属性，我们无法确切知道删除了多少行
            const affectedRows = (result as any).rowsAffected || 0;
            return affectedRows;
        } catch (error) {
            console.error("清理过期记录失败:", error);
            return 0;
        }
    }

    /**
     * 获取聪明钱地址的分析历史
     * @param address 钱包地址
     * @param limit 限制数量
     */
    static async getSmartMoneyAnalysisHistory(address: string, limit: number = 10): Promise<{
        address: string;
        analysisHistory: Array<{
            category: string;
            categoryScore: number;
            analysisTime: Date;
            markName: string;
        }>;
    } | null> {
        try {
            const result = await commonQuery(
                `SELECT category, category_score, last_analysis_time, mark_name 
                 FROM smart_money_address 
                 WHERE address = ? 
                 ORDER BY updated_at DESC 
                 LIMIT ?`,
                [address, limit]
            );

            if ((result as any).rows && (result as any).rows.length > 0) {
                return {
                    address,
                    analysisHistory: (result as any).rows.map((row: any) => ({
                        category: row.category as string,
                        categoryScore: row.category_score as number,
                        analysisTime: new Date(row.last_analysis_time as string),
                        markName: row.mark_name as string
                    }))
                };
            }

            return null;
        } catch (error) {
            console.error("获取聪明钱分析历史失败:", error);
            return null;
        }
    }

    /**
     * 获取指定钱包地址的基准快照（3天前的最后一次快照）
     * @param walletAddresses 钱包地址列表
     * @param daysAgo 几天前，默认3天
     */
    static async getBaselineSnapshots(
        walletAddresses: string[],
        daysAgo: number = 3
    ): Promise<Map<string, any>> {
        const result = new Map<string, any>();

        if (walletAddresses.length === 0) return result;

        try {
            const cutoffTime = new Date();
            cutoffTime.setDate(cutoffTime.getDate() - daysAgo);
            const cutoffTimeStr = cutoffTime.toISOString().slice(0, 19).replace('T', ' ');

            // 分批查询，避免IN子句过长
            // const batchSize = 1000;
            const batchSize = 1;

            for (let i = 0; i < walletAddresses.length; i += batchSize) {
                const batch = walletAddresses.slice(i, i + batchSize);

                const sql = `select * from wallet_trading_ss where wallet_address = ? and snapshot_time <= ? limit 1`;

                const params = [batch[0], cutoffTimeStr];
                const queryResult = await commonQuery(sql, params);


                // console.log("当前进度", ((i / walletAddresses.length) * 100).toFixed(2), "%");

                if (queryResult[0]) {
                    result.set(batch[0], queryResult[0]);
                }
            }

        } catch (error) {
            console.error("获取基准快照失败:", error);
        }
        return result;
    }

    /**
     * 获取指定钱包地址的最新快照
     * @param walletAddresses 钱包地址列表
     */
    static async getLatestSnapshots(
        walletAddresses: string[]
    ): Promise<Map<string, any>> {
        const result = new Map<string, any>();

        if (walletAddresses.length === 0) return result;

        try {
            // 分批查询
            const batchSize = 1;

            for (let i = 0; i < walletAddresses.length; i += batchSize) {
                const batch = walletAddresses.slice(i, i + batchSize);
                // const placeholders = batch.map(() => '?').join(',');

                // const sql = `
                //     SELECT w1.* 
                //     FROM wallet_trading_ss w1
                //     INNER JOIN (
                //         SELECT wallet_address, MAX(snapshot_time) as max_time
                //         FROM wallet_trading_ss 
                //         WHERE wallet_address IN (${placeholders})
                //         GROUP BY wallet_address
                //     ) w2 ON w1.wallet_address = w2.wallet_address 
                //          AND w1.snapshot_time = w2.max_time
                // `;

                const sql = `select * from wallet_trading_ss where wallet_address = ? limit 1`;

                const params = [batch[0]];
                const queryResult = await commonQuery(sql, params);

                if (queryResult[0]) {
                    result.set(batch[0], queryResult[0]);
                }
            }

            console.log(`📊 获取最新快照111: ${result.size}/${walletAddresses.length} 个钱包`);

        } catch (error) {
            console.error("获取最新快照失败:", error);
        }

        return result;
    }
}
