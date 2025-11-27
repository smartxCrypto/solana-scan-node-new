import { db } from '../client';
import { lpInfo, LpInfo, NewLpInfo } from '../schema/lp-info';
import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';

export class LpInfoRepository {
    /**
     * 创建流动性池
     */
    static async create(data: Omit<NewLpInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<LpInfo> {
        const [result] = await db.insert(lpInfo).values(data).returning();
        return result;
    }

    /**
     * 根据池子地址查找
     */
    static async findByPoolAddress(poolAddress: string): Promise<LpInfo | undefined> {
        const [result] = await db
            .select()
            .from(lpInfo)
            .where(eq(lpInfo.poolAddress, poolAddress));
        return result;
    }

    /**
     * 根据代币地址查询相关 LP
     */
    static async findByToken(tokenMint: string): Promise<LpInfo[]> {
        return await db
            .select()
            .from(lpInfo)
            .where(or(
                eq(lpInfo.tokenAMint, tokenMint),
                eq(lpInfo.tokenBMint, tokenMint)
            ))
            .orderBy(desc(lpInfo.liquidityUsd), desc(lpInfo.lastUpdatedTimestamp));
    }

    /**
     * 根据代币对查询 LP
     */
    static async findByTokenPair(tokenA: string, tokenB: string): Promise<LpInfo[]> {
        return await db
            .select()
            .from(lpInfo)
            .where(or(
                and(eq(lpInfo.tokenAMint, tokenA), eq(lpInfo.tokenBMint, tokenB)),
                and(eq(lpInfo.tokenAMint, tokenB), eq(lpInfo.tokenBMint, tokenA))
            ))
            .orderBy(desc(lpInfo.liquidityUsd), desc(lpInfo.lastUpdatedTimestamp));
    }

    /**
     * 更新流动性池信息
     */
    static async update(
        poolAddress: string,
        data: Partial<Omit<LpInfo, 'id' | 'poolAddress' | 'createdAt' | 'updatedAt'>>
    ): Promise<LpInfo | undefined> {
        const [result] = await db
            .update(lpInfo)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(lpInfo.poolAddress, poolAddress))
            .returning();
        return result;
    }

    /**
     * Upsert 流动性池
     */
    static async upsert(data: Omit<NewLpInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<LpInfo> {
        const existing = await this.findByPoolAddress(data.poolAddress);
        
        if (existing) {
            const updated = await this.update(data.poolAddress, data);
            return updated!;
        } else {
            return await this.create(data);
        }
    }

    /**
     * 删除流动性池
     */
    static async delete(poolAddress: string): Promise<boolean> {
        const result = await db
            .delete(lpInfo)
            .where(eq(lpInfo.poolAddress, poolAddress));
        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * 根据流动性获取前 N 个 LP
     */
    static async getTopLiquidityPools(limit: number = 50): Promise<LpInfo[]> {
        return await db
            .select()
            .from(lpInfo)
            .where(gte(lpInfo.liquidityUsd, 0))
            .orderBy(desc(lpInfo.liquidityUsd))
            .limit(limit);
    }

    /**
     * 分页查询 LP
     */
    static async findByPage(params: {
        page: number;
        pageSize: number;
        tokenFilter?: string;
        minLiquidityUsd?: number;
    }): Promise<{ data: LpInfo[]; total: number }> {
        const { page, pageSize, tokenFilter, minLiquidityUsd } = params;
        const conditions = [];

        if (tokenFilter && tokenFilter.trim()) {
            const pattern = `%${tokenFilter.trim()}%`;
            conditions.push(or(
                eq(lpInfo.tokenAMint, tokenFilter.trim()),
                eq(lpInfo.tokenBMint, tokenFilter.trim()),
                ilike(lpInfo.tokenASymbol, pattern),
                ilike(lpInfo.tokenBSymbol, pattern)
            ));
        }

        if (minLiquidityUsd !== undefined && minLiquidityUsd > 0) {
            conditions.push(gte(lpInfo.liquidityUsd, minLiquidityUsd));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (page - 1) * pageSize;

        const dataQuery = db
            .select()
            .from(lpInfo)
            .orderBy(desc(lpInfo.liquidityUsd), desc(lpInfo.lastUpdatedTimestamp))
            .limit(pageSize)
            .offset(offset);

        const countQuery = db
            .select({ count: sql<number>`COUNT(*)` })
            .from(lpInfo);

        if (whereClause) {
            dataQuery.where(whereClause);
            countQuery.where(whereClause);
        }

        const [data, countResult] = await Promise.all([dataQuery, countQuery]);
        const total = countResult[0]?.count || 0;

        return { data, total };
    }

    /**
     * 批量 upsert 流动性池
     */
    static async batchUpsert(dataList: Array<Omit<NewLpInfo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<number> {
        if (dataList.length === 0) return 0;

        await db.insert(lpInfo)
            .values(dataList)
            .onConflictDoUpdate({
                target: lpInfo.poolAddress,
                set: {
                    tokenAMint: sql`EXCLUDED.token_a_mint`,
                    tokenBMint: sql`EXCLUDED.token_b_mint`,
                    tokenASymbol: sql`EXCLUDED.token_a_symbol`,
                    tokenBSymbol: sql`EXCLUDED.token_b_symbol`,
                    tokenAAmount: sql`EXCLUDED.token_a_amount`,
                    tokenBAmount: sql`EXCLUDED.token_b_amount`,
                    liquidityUsd: sql`EXCLUDED.liquidity_usd`,
                    feeRate: sql`EXCLUDED.fee_rate`,
                    lastUpdatedTimestamp: sql`EXCLUDED.last_updated_timestamp`,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });

        return dataList.length;
    }
}

