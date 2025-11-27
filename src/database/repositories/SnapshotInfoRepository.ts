import { db } from '../client';
import { snapshotInfo, SnapshotInfo, NewSnapshotInfo } from '../schema/snapshot-info';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

export class SnapshotInfoRepository {
    /**
     * 创建新的快照记录
     */
    static async create(data: Omit<NewSnapshotInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<SnapshotInfo> {
        const [result] = await db.insert(snapshotInfo).values(data).returning();
        return result;
    }

    /**
     * 根据 ID 获取快照信息
     */
    static async findById(id: number): Promise<SnapshotInfo | undefined> {
        const [result] = await db
            .select()
            .from(snapshotInfo)
            .where(eq(snapshotInfo.id, id));
        return result;
    }

    /**
     * 根据类型获取最新的快照
     */
    static async findLatestByType(type: 'TokenNormSnapShot' | 'SnapShotForWalletTrading'): Promise<SnapshotInfo | undefined> {
        const [result] = await db
            .select()
            .from(snapshotInfo)
            .where(eq(snapshotInfo.type, type))
            .orderBy(desc(snapshotInfo.timestamp), desc(snapshotInfo.id))
            .limit(1);
        return result;
    }

    /**
     * 根据类型获取快照列表（分页）
     */
    static async findByType(
        type: 'TokenNormSnapShot' | 'SnapShotForWalletTrading',
        page: number = 1,
        pageSize: number = 50
    ): Promise<SnapshotInfo[]> {
        const offset = (page - 1) * pageSize;
        return await db
            .select()
            .from(snapshotInfo)
            .where(eq(snapshotInfo.type, type))
            .orderBy(desc(snapshotInfo.timestamp), desc(snapshotInfo.id))
            .limit(pageSize)
            .offset(offset);
    }

    /**
     * 根据时间范围获取快照
     */
    static async findByTimeRange(
        startTimestamp: number,
        endTimestamp: number,
        type?: 'TokenNormSnapShot' | 'SnapShotForWalletTrading'
    ): Promise<SnapshotInfo[]> {
        const conditions = [
            gte(snapshotInfo.timestamp, startTimestamp),
            lte(snapshotInfo.timestamp, endTimestamp),
        ];

        if (type) {
            conditions.push(eq(snapshotInfo.type, type));
        }

        return await db
            .select()
            .from(snapshotInfo)
            .where(and(...conditions))
            .orderBy(desc(snapshotInfo.timestamp), desc(snapshotInfo.id));
    }

    /**
     * 根据区块高度获取快照
     */
    static async findByBlockHeight(
        blockHeight: number,
        type?: 'TokenNormSnapShot' | 'SnapShotForWalletTrading'
    ): Promise<SnapshotInfo | undefined> {
        const conditions = [eq(snapshotInfo.blockHeight, blockHeight)];

        if (type) {
            conditions.push(eq(snapshotInfo.type, type));
        }

        const [result] = await db
            .select()
            .from(snapshotInfo)
            .where(and(...conditions))
            .orderBy(desc(snapshotInfo.timestamp))
            .limit(1);
        
        return result;
    }

    /**
     * 更新快照信息
     */
    static async update(
        id: number,
        data: Partial<Omit<SnapshotInfo, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<SnapshotInfo | undefined> {
        const [result] = await db
            .update(snapshotInfo)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(snapshotInfo.id, id))
            .returning();
        return result;
    }

    /**
     * 删除快照记录
     */
    static async delete(id: number): Promise<boolean> {
        const result = await db
            .delete(snapshotInfo)
            .where(eq(snapshotInfo.id, id));
        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * 批量创建快照记录
     */
    static async batchCreate(dataList: Array<Omit<NewSnapshotInfo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<number> {
        const result = await db.insert(snapshotInfo).values(dataList);
        return result.rowCount || 0;
    }

    /**
     * 获取快照总数（按类型）
     */
    static async count(type?: 'TokenNormSnapShot' | 'SnapShotForWalletTrading'): Promise<number> {
        const query = type
            ? db.select().from(snapshotInfo).where(eq(snapshotInfo.type, type))
            : db.select().from(snapshotInfo);

        const results = await query;
        return results.length;
    }
}

