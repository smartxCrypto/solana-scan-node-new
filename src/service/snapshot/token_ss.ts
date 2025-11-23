import { commonQuery, commonInsert, commonUpdate, commonDelete } from "../../utils/mysqlHelper";
import { TokenNormSnapShot } from "../../type/transaction";

// 数据库表字段接口（snake_case）
export interface TokenSnapshotDB {
    id?: number;
    block_height: number;
    block_time: string; // DATETIME 格式
    token_address: string;
    buy_amount: number;
    sell_amount: number;
    buy_count: number;
    sell_count: number;
    high_price: number;
    low_price: number;
    start_price: number;
    end_price: number;
    avg_price: number;
    pool_address: string;
    snap_shot_block_time: number;
    created_at?: string;
    updated_at?: string;
}

/**
 * 将 TokenNormSnapShot 转换为数据库格式
 */
function tokenSnapShotToDb(snapshot: TokenNormSnapShot): Omit<TokenSnapshotDB, 'id' | 'created_at' | 'updated_at'> {
    return {
        block_height: snapshot.blockHeight,
        block_time: new Date(parseInt(snapshot.blockTime)).toISOString().slice(0, 19).replace('T', ' '),
        token_address: snapshot.tokenAddress,
        buy_amount: snapshot.buyAmount,
        sell_amount: snapshot.sellAmount,
        buy_count: snapshot.buyCount,
        sell_count: snapshot.sellCount,
        high_price: snapshot.highPrice,
        low_price: snapshot.lowPrice,
        start_price: snapshot.startPrice,
        end_price: snapshot.endPrice,
        avg_price: snapshot.avgPrice,
        pool_address: snapshot.poolAddress,
        snap_shot_block_time: snapshot.snapShotBlockTime
    };
}

/**
 * 将数据库格式转换为 TokenNormSnapShot
 */
function dbToTokenSnapShot(dbRecord: TokenSnapshotDB): TokenNormSnapShot {
    return {
        blockHeight: dbRecord.block_height,
        blockTime: new Date(dbRecord.block_time).getTime().toString(),
        tokenAddress: dbRecord.token_address,
        buyAmount: dbRecord.buy_amount,
        sellAmount: dbRecord.sell_amount,
        buyCount: dbRecord.buy_count,
        sellCount: dbRecord.sell_count,
        highPrice: dbRecord.high_price,
        lowPrice: dbRecord.low_price,
        startPrice: dbRecord.start_price,
        endPrice: dbRecord.end_price,
        avgPrice: dbRecord.avg_price,
        poolAddress: dbRecord.pool_address,
        snapShotBlockTime: dbRecord.snap_shot_block_time
    };
}

/**
 * 创建新的 token 快照记录
 */
export async function createTokenSnapshot(snapshot: TokenNormSnapShot): Promise<number | null> {
    const dbData = tokenSnapShotToDb(snapshot);
    const insertSql = `
        INSERT INTO token_ss (
            block_height, block_time, token_address, buy_amount, sell_amount,
            buy_count, sell_count, high_price, low_price, start_price,
            end_price, avg_price, pool_address, snap_shot_block_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const result = await commonInsert(insertSql, [
            dbData.block_height,
            dbData.block_time,
            dbData.token_address,
            dbData.buy_amount,
            dbData.sell_amount,
            dbData.buy_count,
            dbData.sell_count,
            dbData.high_price,
            dbData.low_price,
            dbData.start_price,
            dbData.end_price,
            dbData.avg_price,
            dbData.pool_address,
            dbData.snap_shot_block_time
        ]);

        return result.insertId;
    } catch (error) {
        console.error("Error creating token snapshot:", error);
    }
    return null;
}

/**
 * 批量创建 token 快照记录
 */
export async function batchCreateTokenSnapshots(snapshots: TokenNormSnapShot[]): Promise<number> {
    if (snapshots.length === 0) return 0;

    try {
        const values = snapshots.map(() =>
            '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).join(', ');

        const sql = `
            INSERT INTO token_ss (
                block_height, block_time, token_address, buy_amount, sell_amount,
                buy_count, sell_count, high_price, low_price, start_price,
                end_price, avg_price, pool_address, snap_shot_block_time
            ) VALUES ${values}
        `;

        const params: any[] = [];
        snapshots.forEach(snapshot => {
            const dbData = tokenSnapShotToDb(snapshot);
            params.push(
                dbData.block_height,
                dbData.block_time,
                dbData.token_address,
                dbData.buy_amount,
                dbData.sell_amount,
                dbData.buy_count,
                dbData.sell_count,
                dbData.high_price,
                dbData.low_price,
                dbData.start_price,
                dbData.end_price,
                dbData.avg_price,
                dbData.pool_address,
                dbData.snap_shot_block_time
            );
        });

        const result = await commonInsert(sql, params);
        return result.insertId;
    } catch (error) {
        console.error("Error batch creating token snapshots:", error);
        return 0;
    }
}

/**
 * 根据 ID 获取 token 快照
 */
export async function getTokenSnapshotById(id: number): Promise<TokenNormSnapShot | null> {
    try {
        const sql = `
            SELECT * FROM token_ss WHERE id = ?
        `;

        const result = await commonQuery<TokenSnapshotDB>(sql, [id]);
        if (result[0]) {
            return dbToTokenSnapShot(result[0]);
        }
    } catch (error) {
        console.error("Error getting token snapshot by id:", error);
    }
    return null;
}

/**
 * 根据 token 地址获取快照列表
 */
export async function getTokenSnapshotsByAddress(
    tokenAddress: string,
    page: number = 1,
    pageSize: number = 50
): Promise<TokenNormSnapShot[]> {
    try {
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT * FROM token_ss 
            WHERE token_address = ?
            ORDER BY block_height DESC, id DESC
            LIMIT ? OFFSET ?
        `;

        const result = await commonQuery<TokenSnapshotDB>(sql, [tokenAddress, pageSize, offset]);
        return result.map(dbToTokenSnapShot);
    } catch (error) {
        console.error("Error getting token snapshots by address:", error);
        return [];
    }
}

/**
 * 根据 token 地址和池子地址获取快照列表
 */
export async function getTokenSnapshotsByAddressAndPool(
    tokenAddress: string,
    poolAddress: string,
    page: number = 1,
    pageSize: number = 50
): Promise<TokenNormSnapShot[]> {
    try {
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT * FROM token_ss 
            WHERE token_address = ? AND pool_address = ?
            ORDER BY block_height DESC, id DESC
            LIMIT ? OFFSET ?
        `;

        const result = await commonQuery<TokenSnapshotDB>(sql, [tokenAddress, poolAddress, pageSize, offset]);
        return result.map(dbToTokenSnapShot);
    } catch (error) {
        console.error("Error getting token snapshots by address and pool:", error);
        return [];
    }
}

/**
 * 根据区块高度范围获取快照
 */
export async function getTokenSnapshotsByBlockRange(
    startBlockHeight: number,
    endBlockHeight: number,
    tokenAddress?: string
): Promise<TokenNormSnapShot[]> {
    try {
        let sql = `
            SELECT * FROM token_ss 
            WHERE block_height >= ? AND block_height <= ?
        `;
        const params: any[] = [startBlockHeight, endBlockHeight];

        if (tokenAddress) {
            sql += ` AND token_address = ?`;
            params.push(tokenAddress);
        }

        sql += ` ORDER BY block_height DESC, id DESC`;

        const result = await commonQuery<TokenSnapshotDB>(sql, params);
        return result.map(dbToTokenSnapShot);
    } catch (error) {
        console.error("Error getting token snapshots by block range:", error);
        return [];
    }
}

/**
 * 根据时间范围获取快照
 */
export async function getTokenSnapshotsByTimeRange(
    startTime: string,
    endTime: string,
    tokenAddress?: string
): Promise<TokenNormSnapShot[]> {
    try {
        let sql = `
            SELECT * FROM token_ss 
            WHERE block_time >= ? AND block_time <= ?
        `;
        const params: any[] = [startTime, endTime];

        if (tokenAddress) {
            sql += ` AND token_address = ?`;
            params.push(tokenAddress);
        }

        sql += ` ORDER BY block_time DESC, id DESC`;

        const result = await commonQuery<TokenSnapshotDB>(sql, params);
        return result.map(dbToTokenSnapShot);
    } catch (error) {
        console.error("Error getting token snapshots by time range:", error);
        return [];
    }
}

/**
 * 获取指定 token 的最新快照
 */
export async function getLatestTokenSnapshot(tokenAddress: string, poolAddress?: string): Promise<TokenNormSnapShot | null> {
    try {
        let sql = `
            SELECT * FROM token_ss 
            WHERE token_address = ?
        `;
        const params: any[] = [tokenAddress];

        if (poolAddress) {
            sql += ` AND pool_address = ?`;
            params.push(poolAddress);
        }

        sql += ` ORDER BY block_height DESC, id DESC LIMIT 1`;

        const result = await commonQuery<TokenSnapshotDB>(sql, params);
        if (result[0]) {
            return dbToTokenSnapShot(result[0]);
        }
    } catch (error) {
        console.error("Error getting latest token snapshot:", error);
    }
    return null;
}

/**
 * 更新 token 快照
 */
export async function updateTokenSnapshot(id: number, updateData: Partial<TokenNormSnapShot>): Promise<boolean> {
    try {
        const setClauses: string[] = [];
        const params: any[] = [];

        if (updateData.blockHeight !== undefined) {
            setClauses.push('block_height = ?');
            params.push(updateData.blockHeight);
        }
        if (updateData.blockTime !== undefined) {
            setClauses.push('block_time = ?');
            params.push(new Date(parseInt(updateData.blockTime)).toISOString().slice(0, 19).replace('T', ' '));
        }
        if (updateData.tokenAddress !== undefined) {
            setClauses.push('token_address = ?');
            params.push(updateData.tokenAddress);
        }
        if (updateData.buyAmount !== undefined) {
            setClauses.push('buy_amount = ?');
            params.push(updateData.buyAmount);
        }
        if (updateData.sellAmount !== undefined) {
            setClauses.push('sell_amount = ?');
            params.push(updateData.sellAmount);
        }
        if (updateData.buyCount !== undefined) {
            setClauses.push('buy_count = ?');
            params.push(updateData.buyCount);
        }
        if (updateData.sellCount !== undefined) {
            setClauses.push('sell_count = ?');
            params.push(updateData.sellCount);
        }
        if (updateData.highPrice !== undefined) {
            setClauses.push('high_price = ?');
            params.push(updateData.highPrice);
        }
        if (updateData.lowPrice !== undefined) {
            setClauses.push('low_price = ?');
            params.push(updateData.lowPrice);
        }
        if (updateData.startPrice !== undefined) {
            setClauses.push('start_price = ?');
            params.push(updateData.startPrice);
        }
        if (updateData.endPrice !== undefined) {
            setClauses.push('end_price = ?');
            params.push(updateData.endPrice);
        }
        if (updateData.avgPrice !== undefined) {
            setClauses.push('avg_price = ?');
            params.push(updateData.avgPrice);
        }
        if (updateData.poolAddress !== undefined) {
            setClauses.push('pool_address = ?');
            params.push(updateData.poolAddress);
        }
        if (updateData.snapShotBlockTime !== undefined) {
            setClauses.push('snap_shot_block_time = ?');
            params.push(updateData.snapShotBlockTime);
        }

        if (setClauses.length === 0) {
            return false;
        }

        params.push(id);
        const sql = `
            UPDATE token_ss 
            SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const affectedRows = await commonUpdate(sql, params);
        return affectedRows > 0;
    } catch (error) {
        console.error("Error updating token snapshot:", error);
        return false;
    }
}

/**
 * 删除 token 快照
 */
export async function deleteTokenSnapshot(id: number): Promise<boolean> {
    try {
        const sql = `DELETE FROM token_ss WHERE id = ?`;
        const affectedRows = await commonDelete(sql, [id]);
        return affectedRows > 0;
    } catch (error) {
        console.error("Error deleting token snapshot:", error);
        return false;
    }
}

/**
 * 删除指定 token 地址的所有快照
 */
export async function deleteTokenSnapshotsByAddress(tokenAddress: string): Promise<number> {
    try {
        const sql = `DELETE FROM token_ss WHERE token_address = ?`;
        const affectedRows = await commonDelete(sql, [tokenAddress]);
        return affectedRows;
    } catch (error) {
        console.error("Error deleting token snapshots by address:", error);
        return 0;
    }
}

/**
 * 获取 token 快照总数
 */
export async function getTokenSnapshotCount(tokenAddress?: string): Promise<number> {
    try {
        let sql = `SELECT COUNT(*) as count FROM token_ss`;
        const params: any[] = [];

        if (tokenAddress) {
            sql += ` WHERE token_address = ?`;
            params.push(tokenAddress);
        }

        const result = await commonQuery<{ count: number }>(sql, params);
        return result[0]?.count || 0;
    } catch (error) {
        console.error("Error getting token snapshot count:", error);
        return 0;
    }
}

/**
 * 获取指定 token 的价格统计信息
 */
export async function getTokenPriceStats(
    tokenAddress: string,
    startTime?: string,
    endTime?: string
): Promise<{
    highestPrice: number;
    lowestPrice: number;
    avgPrice: number;
    latestPrice: number;
    totalVolume: number;
} | null> {
    try {
        let sql = `
            SELECT 
                MAX(high_price) as highest_price,
                MIN(low_price) as lowest_price,
                AVG(avg_price) as avg_price,
                (SELECT end_price FROM token_ss WHERE token_address = ? ORDER BY block_height DESC LIMIT 1) as latest_price,
                SUM(buy_amount + sell_amount) as total_volume
            FROM token_ss 
            WHERE token_address = ?
        `;
        const params: any[] = [tokenAddress, tokenAddress];

        if (startTime && endTime) {
            sql += ` AND block_time >= ? AND block_time <= ?`;
            params.push(startTime, endTime);
        }

        const result = await commonQuery<{
            highest_price: number;
            lowest_price: number;
            avg_price: number;
            latest_price: number;
            total_volume: number;
        }>(sql, params);

        if (result[0]) {
            return {
                highestPrice: result[0].highest_price,
                lowestPrice: result[0].lowest_price,
                avgPrice: result[0].avg_price,
                latestPrice: result[0].latest_price,
                totalVolume: result[0].total_volume
            };
        }
    } catch (error) {
        console.error("Error getting token price stats:", error);
    }
    return null;
}

/**
 * 保存快照数据到数据库（为 index 中的 snapShotTokenData 方法提供支持）
 */
export async function saveTokenSnapshots(snapshots: TokenNormSnapShot[]): Promise<boolean> {
    try {
        const insertedCount = await batchCreateTokenSnapshots(snapshots);
        console.log(`Successfully saved ${insertedCount} token snapshots to database`);
        return insertedCount > 0;
    } catch (error) {
        console.error("Error saving token snapshots:", error);
        return false;
    }
}
