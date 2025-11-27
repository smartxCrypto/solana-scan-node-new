import { db } from '../client';
import { smartMoneyAddress, SmartMoneyAddress, NewSmartMoneyAddress } from '../schema/smart-money';
import { eq, desc, sql, inArray, max } from 'drizzle-orm';

export class SmartMoneyRepository {
    /**
     * 创建聪明钱地址
     */
    static async create(data: Omit<NewSmartMoneyAddress, 'id' | 'createdAt' | 'updatedAt'>): Promise<SmartMoneyAddress> {
        const [result] = await db.insert(smartMoneyAddress).values(data).returning();
        return result;
    }

    /**
     * 根据钱包地址查找
     */
    static async findByWalletAddress(walletAddress: string): Promise<SmartMoneyAddress | undefined> {
        const [result] = await db
            .select()
            .from(smartMoneyAddress)
            .where(eq(smartMoneyAddress.walletAddress, walletAddress));
        return result;
    }

    /**
     * 更新聪明钱信息
     */
    static async update(
        walletAddress: string,
        data: Partial<Omit<SmartMoneyAddress, 'id' | 'walletAddress' | 'createdAt' | 'updatedAt'>>
    ): Promise<SmartMoneyAddress | undefined> {
        const [result] = await db
            .update(smartMoneyAddress)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(smartMoneyAddress.walletAddress, walletAddress))
            .returning();
        return result;
    }

    /**
     * Upsert 聪明钱地址
     */
    static async upsert(data: Omit<NewSmartMoneyAddress, 'id' | 'createdAt' | 'updatedAt'>): Promise<SmartMoneyAddress> {
        const existing = await this.findByWalletAddress(data.walletAddress);
        
        if (existing) {
            const updated = await this.update(data.walletAddress, data);
            return updated!;
        } else {
            return await this.create(data);
        }
    }

    /**
     * 删除聪明钱地址
     */
    static async delete(walletAddress: string): Promise<boolean> {
        const result = await db
            .delete(smartMoneyAddress)
            .where(eq(smartMoneyAddress.walletAddress, walletAddress));
        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * 获取所有活跃的聪明钱地址
     */
    static async findAllActive(): Promise<SmartMoneyAddress[]> {
        return await db
            .select()
            .from(smartMoneyAddress)
            .where(eq(smartMoneyAddress.isActive, true));
    }

    /**
     * 获取所有聪明钱地址列表（只返回地址字符串）
     */
    static async findAllWalletAddresses(): Promise<string[]> {
        const results = await db
            .select({ walletAddress: smartMoneyAddress.walletAddress })
            .from(smartMoneyAddress);
        return results.map(r => r.walletAddress);
    }

    /**
     * 批量检查哪些地址已存在
     */
    static async findExistingAddresses(addresses: string[]): Promise<string[]> {
        if (addresses.length === 0) return [];
        
        const results = await db
            .select({ walletAddress: smartMoneyAddress.walletAddress })
            .from(smartMoneyAddress)
            .where(inArray(smartMoneyAddress.walletAddress, addresses));
        
        return results.map(r => r.walletAddress);
    }

    /**
     * 批量创建聪明钱地址
     */
    static async batchCreate(dataList: Array<Omit<NewSmartMoneyAddress, 'id' | 'createdAt' | 'updatedAt'>>): Promise<number> {
        let count = 0;
        for (const data of dataList) {
            try {
                await this.create(data);
                count++;
            } catch (error) {
                console.error(`Failed to create smart money address ${data.walletAddress}:`, error);
            }
        }
        return count;
    }

    /**
     * 根据标签查询聪明钱地址
     */
    static async findByLabel(label: string): Promise<SmartMoneyAddress[]> {
        return await db
            .select()
            .from(smartMoneyAddress)
            .where(eq(smartMoneyAddress.label, label))
            .orderBy(desc(smartMoneyAddress.confidenceScore));
    }

    /**
     * 获取统计信息
     */
    static async getStatistics(): Promise<{
        total: number;
        byLabel: Record<string, number>;
        lastActiveTimestamp: number | null;
    }> {
        const [totalResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(smartMoneyAddress);
        
        const labelResults = await db
            .select({
                label: smartMoneyAddress.label,
                count: sql<number>`count(*)`
            })
            .from(smartMoneyAddress)
            .groupBy(smartMoneyAddress.label);

        const [maxTimestampResult] = await db
            .select({ maxTimestamp: max(smartMoneyAddress.lastActiveTimestamp) })
            .from(smartMoneyAddress);

        const byLabel: Record<string, number> = {};
        labelResults.forEach(row => {
            if (row.label) {
                byLabel[row.label] = Number(row.count);
            }
        });

        return {
            total: Number(totalResult.count),
            byLabel,
            lastActiveTimestamp: maxTimestampResult.maxTimestamp ? Number(maxTimestampResult.maxTimestamp) : null
        };
    }

    /**
     * 获取最近添加的聪明钱地址
     */
    static async findRecent(limit: number = 50): Promise<SmartMoneyAddress[]> {
        return await db
            .select()
            .from(smartMoneyAddress)
            .orderBy(desc(smartMoneyAddress.createdAt))
            .limit(limit);
    }

    /**
     * 清理过期记录
     */
    static async cleanupOutdated(daysOld: number = 30): Promise<number> {
        const cutoffTimestamp = Math.floor((Date.now() - daysOld * 24 * 60 * 60 * 1000) / 1000);
        
        const result = await db
            .delete(smartMoneyAddress)
            .where(sql`${smartMoneyAddress.lastActiveTimestamp} < ${cutoffTimestamp}`);
        
        return result.rowCount || 0;
    }
}

