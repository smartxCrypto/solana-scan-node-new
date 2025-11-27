import { db } from '../client';
import { tokenSnapshot, TokenSnapshot, NewTokenSnapshot } from '../schema/token-snapshot';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

export class TokenSnapshotRepository {
    /**
     * 创建代币快照
     */
    static async create(data: Omit<NewTokenSnapshot, 'id' | 'createdAt' | 'updatedAt'>): Promise<TokenSnapshot> {
        const [result] = await db.insert(tokenSnapshot).values(data).returning();
        return result;
    }

    /**
     * 批量创建代币快照
     */
    static async batchCreate(dataList: Array<Omit<NewTokenSnapshot, 'id' | 'createdAt' | 'updatedAt'>>): Promise<number> {
        if (dataList.length === 0) return 0;
        
        const result = await db.insert(tokenSnapshot).values(dataList);
        return result.rowCount || 0;
    }

    /**
     * 根据 ID 获取快照
     */
    static async findById(id: bigint): Promise<TokenSnapshot | undefined> {
        const [result] = await db
            .select()
            .from(tokenSnapshot)
            .where(eq(tokenSnapshot.id, id));
        return result;
    }

    /**
     * 根据代币地址获取最新快照
     */
    static async findLatestByToken(tokenAddress: string): Promise<TokenSnapshot | undefined> {
        const [result] = await db
            .select()
            .from(tokenSnapshot)
            .where(eq(tokenSnapshot.tokenAddress, tokenAddress))
            .orderBy(desc(tokenSnapshot.blockHeight), desc(tokenSnapshot.id))
            .limit(1);
        return result;
    }

    /**
     * 根据代币地址获取快照列表（分页）
     */
    static async findByToken(
        tokenAddress: string,
        page: number = 1,
        pageSize: number = 50
    ): Promise<TokenSnapshot[]> {
        const offset = (page - 1) * pageSize;
        return await db
            .select()
            .from(tokenSnapshot)
            .where(eq(tokenSnapshot.tokenAddress, tokenAddress))
            .orderBy(desc(tokenSnapshot.blockHeight), desc(tokenSnapshot.id))
            .limit(pageSize)
            .offset(offset);
    }

    /**
     * 根据区块高度范围获取快照
     */
    static async findByBlockRange(
        startBlockHeight: number,
        endBlockHeight: number,
        tokenAddress?: string
    ): Promise<TokenSnapshot[]> {
        const conditions = [
            gte(tokenSnapshot.blockHeight, startBlockHeight),
            lte(tokenSnapshot.blockHeight, endBlockHeight),
        ];

        if (tokenAddress) {
            conditions.push(eq(tokenSnapshot.tokenAddress, tokenAddress));
        }

        return await db
            .select()
            .from(tokenSnapshot)
            .where(and(...conditions))
            .orderBy(tokenSnapshot.blockHeight, tokenSnapshot.tokenAddress);
    }

    /**
     * 根据时间范围获取快照
     */
    static async findByTimeRange(
        startTime: Date,
        endTime: Date,
        tokenAddress?: string
    ): Promise<TokenSnapshot[]> {
        const conditions = [
            gte(tokenSnapshot.blockTime, startTime),
            lte(tokenSnapshot.blockTime, endTime),
        ];

        if (tokenAddress) {
            conditions.push(eq(tokenSnapshot.tokenAddress, tokenAddress));
        }

        return await db
            .select()
            .from(tokenSnapshot)
            .where(and(...conditions))
            .orderBy(tokenSnapshot.blockTime);
    }

    /**
     * 更新快照
     */
    static async update(
        id: bigint,
        data: Partial<Omit<TokenSnapshot, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<TokenSnapshot | undefined> {
        const [result] = await db
            .update(tokenSnapshot)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(tokenSnapshot.id, id))
            .returning();
        return result;
    }

    /**
     * 删除快照
     */
    static async delete(id: bigint): Promise<boolean> {
        const result = await db
            .delete(tokenSnapshot)
            .where(eq(tokenSnapshot.id, id));
        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * 保存快照（批量插入）
     */
    static async saveSnapshots(snapshots: Array<Omit<NewTokenSnapshot, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            if (snapshots.length === 0) return false;
            await db.insert(tokenSnapshot).values(snapshots);
            return true;
        } catch (error) {
            console.error('Error saving token snapshots:', error);
            return false;
        }
    }
}

