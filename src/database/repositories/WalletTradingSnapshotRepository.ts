import { db } from '../client';
import { walletTradingSnapshot, WalletTradingSnapshot, NewWalletTradingSnapshot } from '../schema/wallet-trading-snapshot';
import { eq, desc, and, lt, sql, inArray } from 'drizzle-orm';

export class WalletTradingSnapshotRepository {
    /**
     * 创建钱包交易快照
     */
    static async create(data: Omit<NewWalletTradingSnapshot, 'id' | 'createdAt' | 'updatedAt'>): Promise<WalletTradingSnapshot> {
        const [result] = await db.insert(walletTradingSnapshot).values(data).returning();
        return result;
    }

    /**
     * 批量创建钱包交易快照
     */
    static async batchCreate(dataList: Array<Omit<NewWalletTradingSnapshot, 'id' | 'createdAt' | 'updatedAt'>>): Promise<number> {
        if (dataList.length === 0) return 0;
        
        const result = await db.insert(walletTradingSnapshot).values(dataList);
        return result.rowCount || 0;
    }

    /**
     * 根据 ID 获取快照
     */
    static async findById(id: bigint): Promise<WalletTradingSnapshot | undefined> {
        const [result] = await db
            .select()
            .from(walletTradingSnapshot)
            .where(eq(walletTradingSnapshot.id, id));
        return result;
    }

    /**
     * 获取钱包的最新快照
     */
    static async findLatestByWallet(walletAddress: string): Promise<WalletTradingSnapshot | undefined> {
        const [result] = await db
            .select()
            .from(walletTradingSnapshot)
            .where(eq(walletTradingSnapshot.walletAddress, walletAddress))
            .orderBy(desc(walletTradingSnapshot.snapshotTime), desc(walletTradingSnapshot.id))
            .limit(1);
        return result;
    }

    /**
     * 获取钱包在指定时间之前的最新快照
     */
    static async findLatestBeforeTime(
        walletAddress: string,
        timestamp: Date
    ): Promise<WalletTradingSnapshot | undefined> {
        const [result] = await db
            .select()
            .from(walletTradingSnapshot)
            .where(
                and(
                    eq(walletTradingSnapshot.walletAddress, walletAddress),
                    lt(walletTradingSnapshot.snapshotTime, timestamp)
                )
            )
            .orderBy(desc(walletTradingSnapshot.snapshotTime), desc(walletTradingSnapshot.id))
            .limit(1);
        return result;
    }

    /**
     * 批量获取多个钱包在指定时间之前的最新快照
     */
    static async batchFindLatestBeforeTime(
        walletAddresses: string[],
        timestamp: Date
    ): Promise<Map<string, WalletTradingSnapshot>> {
        if (walletAddresses.length === 0) {
            return new Map();
        }

        // 使用子查询获取每个钱包的最新快照
        const results = await db
            .select()
            .from(walletTradingSnapshot)
            .where(
                and(
                    inArray(walletTradingSnapshot.walletAddress, walletAddresses),
                    lt(walletTradingSnapshot.snapshotTime, timestamp)
                )
            )
            .orderBy(
                walletTradingSnapshot.walletAddress,
                desc(walletTradingSnapshot.snapshotTime),
                desc(walletTradingSnapshot.id)
            );

        // 过滤出每个钱包的最新记录
        const resultMap = new Map<string, WalletTradingSnapshot>();
        for (const snapshot of results) {
            if (!resultMap.has(snapshot.walletAddress)) {
                resultMap.set(snapshot.walletAddress, snapshot);
            }
        }

        return resultMap;
    }

    /**
     * 根据钱包地址获取快照列表（分页）
     */
    static async findByWallet(
        walletAddress: string,
        page: number = 1,
        pageSize: number = 50
    ): Promise<WalletTradingSnapshot[]> {
        const offset = (page - 1) * pageSize;
        return await db
            .select()
            .from(walletTradingSnapshot)
            .where(eq(walletTradingSnapshot.walletAddress, walletAddress))
            .orderBy(desc(walletTradingSnapshot.snapshotTime), desc(walletTradingSnapshot.id))
            .limit(pageSize)
            .offset(offset);
    }

    /**
     * 根据盈亏情况获取钱包列表
     */
    static async findByProfitLoss(
        minWinCount?: number,
        minLoseCount?: number,
        minPnlUsd?: number,
        page: number = 1,
        pageSize: number = 50
    ): Promise<WalletTradingSnapshot[]> {
        const conditions = [];

        if (minWinCount !== undefined) {
            conditions.push(sql`${walletTradingSnapshot.winCount} >= ${minWinCount}`);
        }
        if (minLoseCount !== undefined) {
            conditions.push(sql`${walletTradingSnapshot.loseCount} >= ${minLoseCount}`);
        }
        if (minPnlUsd !== undefined) {
            conditions.push(
                sql`(${walletTradingSnapshot.totalSellUsdAmount} - ${walletTradingSnapshot.totalBuyUsdAmount}) >= ${minPnlUsd}`
            );
        }

        const offset = (page - 1) * pageSize;
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        return await db
            .select()
            .from(walletTradingSnapshot)
            .where(whereClause)
            .orderBy(desc(walletTradingSnapshot.snapshotTime))
            .limit(pageSize)
            .offset(offset);
    }

    /**
     * 更新快照
     */
    static async update(
        id: bigint,
        data: Partial<Omit<WalletTradingSnapshot, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<WalletTradingSnapshot | undefined> {
        const [result] = await db
            .update(walletTradingSnapshot)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(walletTradingSnapshot.id, id))
            .returning();
        return result;
    }

    /**
     * 删除快照
     */
    static async delete(id: bigint): Promise<boolean> {
        const result = await db
            .delete(walletTradingSnapshot)
            .where(eq(walletTradingSnapshot.id, id));
        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * 保存快照（批量插入或更新）
     */
    static async saveSnapshots(snapshots: Array<Omit<NewWalletTradingSnapshot, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            if (snapshots.length === 0) return false;
            await db.insert(walletTradingSnapshot).values(snapshots);
            return true;
        } catch (error) {
            console.error('Error saving wallet trading snapshots:', error);
            return false;
        }
    }

    /**
     * 获取活跃钱包地址列表
     */
    static async findActiveWallets(cutoffTime: Date): Promise<string[]> {
        const results = await db
            .selectDistinct({ walletAddress: walletTradingSnapshot.walletAddress })
            .from(walletTradingSnapshot)
            .where(sql`${walletTradingSnapshot.createdAt} >= ${cutoffTime}`);
        
        return results.map(r => r.walletAddress);
    }

    /**
     * 获取钱包统计信息
     */
    static async getWalletStats(walletAddresses: string[], cutoffTime: Date): Promise<any[]> {
        if (walletAddresses.length === 0) return [];

        const results = await db
            .select({
                walletAddress: walletTradingSnapshot.walletAddress,
                totalTransactions: sql<number>`SUM(${walletTradingSnapshot.buyCount} + ${walletTradingSnapshot.sellCount})`,
                totalBuyCount: sql<number>`SUM(${walletTradingSnapshot.buyCount})`,
                totalSellCount: sql<number>`SUM(${walletTradingSnapshot.sellCount})`,
                uniqueTokens: sql<number>`COUNT(DISTINCT (jsonb_array_elements(${walletTradingSnapshot.currentTokenValue}::jsonb)->>'tokenAddress'))`,
                totalBuyVolume: sql<number>`SUM(${walletTradingSnapshot.totalBuySolAmount})`,
                totalSellVolume: sql<number>`SUM(${walletTradingSnapshot.totalSellSolAmount})`,
                firstActivityTime: sql<Date>`MIN(${walletTradingSnapshot.snapshotTime})`,
                lastActivityTime: sql<Date>`MAX(${walletTradingSnapshot.snapshotTime})`,
                pnlSol: sql<number>`SUM(${walletTradingSnapshot.totalSellSolAmount} - ${walletTradingSnapshot.totalBuySolAmount})`,
                pnlUsd: sql<number>`SUM(${walletTradingSnapshot.totalSellUsdAmount} - ${walletTradingSnapshot.totalBuyUsdAmount})`,
                winCount: sql<number>`MAX(${walletTradingSnapshot.winCount})`,
                loseCount: sql<number>`MAX(${walletTradingSnapshot.loseCount})`,
            })
            .from(walletTradingSnapshot)
            .where(
                and(
                    sql`${walletTradingSnapshot.snapshotTime} >= ${cutoffTime}`,
                    inArray(walletTradingSnapshot.walletAddress, walletAddresses)
                )
            )
            .groupBy(walletTradingSnapshot.walletAddress)
            .orderBy(sql`SUM(${walletTradingSnapshot.totalSellSolAmount} - ${walletTradingSnapshot.totalBuySolAmount}) DESC`);

        return results;
    }
}

