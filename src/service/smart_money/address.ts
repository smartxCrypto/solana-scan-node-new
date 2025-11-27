
import { SmartMoneyRepository } from "@/database/repositories";
import { WalletTradingSnapshotRepository } from "@/database/repositories";

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
            return await SmartMoneyRepository.findAllWalletAddresses();
        } catch (error) {
            console.error("获取聪明钱地址列表失败:", error);
            return [];
        }
    }

    /**
     * 获取过去指定天数内的活跃钱包地址（排除已知聪明钱地址）
     * @param days 过去天数
     * @param minTransactionCount 最低交易次数
     * @param minBuyCount 最低买入次数
     * @param minTokenCount 最低交易代币种类数
     */
    static async getActiveWalletsExcludingSmartMoney(
        days: number = 1,
        minTransactionCount: number = 5,
        minBuyCount: number = 2,
        minTokenCount: number = 1
    ): Promise<string[]> {
        try {
            const smartMoneyAddresses = await this.getAllSmartMoneyAddresses();
            const smartMoneySet = new Set(smartMoneyAddresses);

            const cutoffTime = new Date();
            cutoffTime.setDate(cutoffTime.getDate() - days);

            const activeWallets = await WalletTradingSnapshotRepository.findActiveWallets(cutoffTime);
            
            console.log("activeResult", activeWallets.length);

            const candidateWallets = activeWallets.filter(wallet => !smartMoneySet.has(wallet));

            console.log("candidateWallets", candidateWallets.length);

            return candidateWallets;

        } catch (error) {
            console.error("获取活跃钱包地址失败:", error);
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

            const stats = await WalletTradingSnapshotRepository.getWalletStats(walletAddresses, cutoffTime);

            return stats.map((row: any) => ({
                walletAddress: row.walletAddress as string,
                totalTransactions: Number(row.totalTransactions),
                totalBuyCount: Number(row.totalBuyCount),
                totalSellCount: Number(row.totalSellCount),
                uniqueTokens: Number(row.uniqueTokens),
                totalBuyVolume: Number(row.totalBuyVolume),
                totalSellVolume: Number(row.totalSellVolume),
                firstActivityTime: new Date(row.firstActivityTime),
                lastActivityTime: new Date(row.lastActivityTime),
                pnlSol: Number(row.pnlSol),
                pnlUsd: Number(row.pnlUsd),
                winCount: Number(row.winCount),
                loseCount: Number(row.loseCount)
            }));

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
            const result = await SmartMoneyRepository.findByWalletAddress(address);
            return !!result;
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
            return await SmartMoneyRepository.findExistingAddresses(addresses);
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
            const timestamp = record.last_analysis_time ? Math.floor(record.last_analysis_time.getTime() / 1000) : Math.floor(Date.now() / 1000);
            
            await SmartMoneyRepository.create({
                walletAddress: record.address,
                label: record.mark_name || null,
                confidenceScore: record.category_score || 0,
                totalPnl: 0,
                winRate: 0,
                totalTrades: 0,
                firstSeenTimestamp: BigInt(timestamp),
                lastActiveTimestamp: BigInt(timestamp),
                isActive: true
            });
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
            await SmartMoneyRepository.update(address, {
                confidenceScore: categoryScore,
                lastActiveTimestamp: BigInt(Math.floor(analysisTime.getTime() / 1000))
            });
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
            const results = await SmartMoneyRepository.findByLabel(category);

            return results.map((row: any) => ({
                id: Number(row.id),
                address: row.walletAddress as string,
                category: row.label as string,
                category_score: row.confidenceScore as number,
                mark_name: row.label as string,
                last_analysis_time: new Date(Number(row.lastActiveTimestamp) * 1000),
                created_at: new Date(row.createdAt),
                updated_at: new Date(row.updatedAt)
            }));
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
            const stats = await SmartMoneyRepository.getStatistics();

            return {
                total: stats.total,
                byCategory: stats.byLabel,
                lastAnalysisTime: stats.lastActiveTimestamp ? new Date(stats.lastActiveTimestamp * 1000) : null
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
            const results = await SmartMoneyRepository.findRecent(limit);

            return results.map((row: any) => ({
                id: Number(row.id),
                address: row.walletAddress as string,
                category: row.label as string,
                category_score: row.confidenceScore as number,
                mark_name: row.label as string,
                last_analysis_time: new Date(Number(row.lastActiveTimestamp) * 1000),
                created_at: new Date(row.createdAt),
                updated_at: new Date(row.updatedAt)
            }));
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
            return await SmartMoneyRepository.cleanupOutdated(daysOld);
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
            const result = await SmartMoneyRepository.findByWalletAddress(address);

            if (!result) {
                return null;
            }

            return {
                address,
                analysisHistory: [{
                    category: result.label || '',
                    categoryScore: result.confidenceScore || 0,
                    analysisTime: new Date(Number(result.lastActiveTimestamp) * 1000),
                    markName: result.label || ''
                }]
            };
        } catch (error) {
            console.error("获取聪明钱分析历史失败:", error);
            return null;
        }
    }

    /**
     * 获取指定钱包地址的基准快照（指定天数前的最后一次快照）
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

            for (const walletAddress of walletAddresses) {
                const snapshot = await WalletTradingSnapshotRepository.findLatestBeforeTime(
                    walletAddress,
                    cutoffTime
                );

                if (snapshot) {
                    result.set(walletAddress, snapshot);
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
            for (const walletAddress of walletAddresses) {
                const snapshot = await WalletTradingSnapshotRepository.findLatestByWallet(walletAddress);

                if (snapshot) {
                    result.set(walletAddress, snapshot);
                }
            }

            console.log(`📊 获取最新快照: ${result.size}/${walletAddresses.length} 个钱包`);

        } catch (error) {
            console.error("获取最新快照失败:", error);
        }

        return result;
    }
}
