import { db } from '../client';
import { token, Token, NewToken } from '../schema/token';
import { eq, or, ilike, desc, sql } from 'drizzle-orm';

export class TokenRepository {
    /**
     * 创建代币
     */
    static async create(data: Omit<NewToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<Token> {
        const [result] = await db.insert(token).values(data).returning();
        return result;
    }

    /**
     * 根据代币地址查找
     */
    static async findByAddress(tokenAddress: string): Promise<Token | undefined> {
        const [result] = await db
            .select()
            .from(token)
            .where(eq(token.tokenAddress, tokenAddress));
        return result;
    }

    /**
     * 根据 ID 查找
     */
    static async findById(id: bigint): Promise<Token | undefined> {
        const [result] = await db
            .select()
            .from(token)
            .where(eq(token.id, id));
        return result;
    }

    /**
     * 更新代币信息
     */
    static async update(
        tokenAddress: string,
        data: Partial<Omit<Token, 'id' | 'tokenAddress' | 'createdAt' | 'updatedAt'>>
    ): Promise<Token | undefined> {
        const [result] = await db
            .update(token)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(token.tokenAddress, tokenAddress))
            .returning();
        return result;
    }

    /**
     * Upsert 代币（存在则更新，不存在则插入）
     */
    static async upsert(data: Omit<NewToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<Token> {
        const existing = await this.findByAddress(data.tokenAddress);
        
        if (existing) {
            const updated = await this.update(data.tokenAddress, data);
            return updated!;
        } else {
            return await this.create(data);
        }
    }

    /**
     * 批量 Upsert
     */
    static async batchUpsert(dataList: Array<Omit<NewToken, 'id' | 'createdAt' | 'updatedAt'>>): Promise<number> {
        let count = 0;
        for (const data of dataList) {
            await this.upsert(data);
            count++;
        }
        return count;
    }

    /**
     * 删除代币
     */
    static async delete(tokenAddress: string): Promise<boolean> {
        const result = await db
            .delete(token)
            .where(eq(token.tokenAddress, tokenAddress));
        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * 批量删除代币
     */
    static async batchDelete(tokenAddresses: string[]): Promise<number> {
        let deletedCount = 0;
        for (const address of tokenAddresses) {
            const deleted = await this.delete(address);
            if (deleted) deletedCount++;
        }
        return deletedCount;
    }

    /**
     * 分页查询代币
     */
    static async findByPage(params: {
        page: number;
        pageSize: number;
        searchKeyword?: string;
    }): Promise<{ data: Token[]; total: number }> {
        const { page, pageSize, searchKeyword } = params;
        const offset = (page - 1) * pageSize;

        let queryBuilder = db.select().from(token);
        let countQueryBuilder = db.select({ count: sql<number>`count(*)` }).from(token);

        if (searchKeyword && searchKeyword.trim()) {
            const searchPattern = `%${searchKeyword.trim()}%`;
            const searchCondition = or(
                ilike(token.name, searchPattern),
                ilike(token.symbol, searchPattern),
                ilike(token.tokenAddress, searchPattern)
            );
            queryBuilder = queryBuilder.where(searchCondition) as any;
            countQueryBuilder = countQueryBuilder.where(searchCondition) as any;
        }

        const data = await queryBuilder
            .orderBy(desc(token.createdAt), token.name)
            .limit(pageSize)
            .offset(offset);

        const [{ count }] = await countQueryBuilder;

        return { data, total: Number(count) };
    }

    /**
     * 查询 sol_scan_image 为空的代币
     */
    static async findWithEmptySolScanImage(params: {
        page: number;
        pageSize: number;
    }): Promise<{ data: Token[]; total: number }> {
        const { page, pageSize } = params;
        const offset = (page - 1) * pageSize;

        const searchCondition = or(
            eq(token.solScanImage, ''),
            eq(token.solScanImage, 'null'),
            sql`${token.solScanImage} IS NULL`
        );

        const data = await db
            .select()
            .from(token)
            .where(searchCondition)
            .orderBy(desc(token.createdAt), token.name)
            .limit(pageSize)
            .offset(offset);

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(token)
            .where(searchCondition);

        return { data, total: Number(count) };
    }
}

