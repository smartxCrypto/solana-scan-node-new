import { commonQuery } from "../../utils/mysqlHelper";
import { SnapshotInfo, SnapShotType } from "../../type/snapshot";

/**
 * 创建新的快照记录
 */
export async function createSnapshot(snapshotData: Omit<SnapshotInfo, 'id'>): Promise<number | null> {
    const insertSql = `
        INSERT INTO snapshot_info (timestamp, type, blockHeight, blockTime)
        VALUES (?, ?, ?, ?)
    `;

    try {
        const result = await commonQuery(insertSql, [
            snapshotData.timestamp,
            snapshotData.type,
            snapshotData.blockHeight,
            snapshotData.blockTime
        ]);
        const insertId = (result as any).lastInsertId;
        return insertId;
    } catch (error) {
        console.error("Error creating snapshot:", error);
    }
    return null;
}

/**
 * 根据 ID 获取快照信息
 */
export async function getSnapshotById(id: number): Promise<SnapshotInfo | null> {
    try {
        const sql = `
            SELECT id, timestamp, type, blockHeight, blockTime
            FROM snapshot_info
            WHERE id = ?
        `;

        const result = await commonQuery<SnapshotInfo>(sql, [id]);
        return result[0] || null;
    } catch (error) {
        console.error("Error getting snapshot by id:", error);
        return null;
    }
}

/**
 * 根据类型获取最近的一次快照数据（特殊查询方法）
 */
export async function getLatestSnapshotByType(type: SnapShotType): Promise<SnapshotInfo | null> {
    try {
        const sql = `
            SELECT id, timestamp, type, blockHeight, blockTime
            FROM snapshot_info
            WHERE type = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT 1
        `;

        const result = await commonQuery<SnapshotInfo>(sql, [type]);
        return result[0] || null;
    } catch (error) {
        console.error("Error getting latest snapshot by type:", error);
        return null;
    }
}

/**
 * 获取指定类型的快照列表（分页）
 */
export async function getSnapshotsByType(
    type: SnapShotType,
    page: number = 1,
    pageSize: number = 50
): Promise<SnapshotInfo[]> {
    try {
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT id, timestamp, type, blockHeight, blockTime
            FROM snapshot_info
            WHERE type = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT ? OFFSET ?
        `;

        const result = await commonQuery<SnapshotInfo>(sql, [type, pageSize, offset]);
        return result;
    } catch (error) {
        console.error("Error getting snapshots by type:", error);
        return [];
    }
}

/**
 * 获取指定时间范围内的快照
 */
export async function getSnapshotsByTimeRange(
    startTimestamp: number,
    endTimestamp: number,
    type?: SnapShotType
): Promise<SnapshotInfo[]> {
    try {
        let sql = `
            SELECT id, timestamp, type, blockHeight, blockTime
            FROM snapshot_info
            WHERE timestamp >= ? AND timestamp <= ?
        `;
        const params: any[] = [startTimestamp, endTimestamp];

        if (type) {
            sql += ` AND type = ?`;
            params.push(type);
        }

        sql += ` ORDER BY timestamp DESC, id DESC`;

        const result = await commonQuery<SnapshotInfo>(sql, params);
        return result;
    } catch (error) {
        console.error("Error getting snapshots by time range:", error);
        return [];
    }
}

/**
 * 更新快照信息
 */
export async function updateSnapshot(id: number, updateData: Partial<Omit<SnapshotInfo, 'id'>>): Promise<boolean> {
    try {
        const setClauses: string[] = [];
        const params: any[] = [];

        if (updateData.timestamp !== undefined) {
            setClauses.push('timestamp = ?');
            params.push(updateData.timestamp);
        }
        if (updateData.type !== undefined) {
            setClauses.push('type = ?');
            params.push(updateData.type);
        }
        if (updateData.blockHeight !== undefined) {
            setClauses.push('blockHeight = ?');
            params.push(updateData.blockHeight);
        }
        if (updateData.blockTime !== undefined) {
            setClauses.push('blockTime = ?');
            params.push(updateData.blockTime);
        }

        if (setClauses.length === 0) {
            return false;
        }

        params.push(id);
        const sql = `
            UPDATE snapshot_info 
            SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const result = await commonQuery(sql, params);
        return (result as any).affectedRows > 0;
    } catch (error) {
        console.error("Error updating snapshot:", error);
        return false;
    }
}

/**
 * 删除快照记录
 */
export async function deleteSnapshot(id: number): Promise<boolean> {
    try {
        const sql = `DELETE FROM snapshot_info WHERE id = ?`;
        const result = await commonQuery(sql, [id]);
        return (result as any).affectedRows > 0;
    } catch (error) {
        console.error("Error deleting snapshot:", error);
        return false;
    }
}

/**
 * 获取快照总数（按类型）
 */
export async function getSnapshotCount(type?: SnapShotType): Promise<number> {
    try {
        let sql = `SELECT COUNT(*) as count FROM snapshot_info`;
        const params: any[] = [];

        if (type) {
            sql += ` WHERE type = ?`;
            params.push(type);
        }

        const result = await commonQuery<{ count: number }>(sql, params);
        return result[0]?.count || 0;
    } catch (error) {
        console.error("Error getting snapshot count:", error);
        return 0;
    }
}

/**
 * 批量创建快照记录
 */
export async function batchCreateSnapshots(snapshots: Omit<SnapshotInfo, 'id'>[]): Promise<number> {
    if (snapshots.length === 0) return 0;

    try {
        const values = snapshots.map(() => '(?, ?, ?, ?)').join(', ');
        const sql = `
            INSERT INTO snapshot_info (timestamp, type, blockHeight, blockTime)
            VALUES ${values}
        `;

        const params: any[] = [];
        snapshots.forEach(snapshot => {
            params.push(snapshot.timestamp, snapshot.type, snapshot.blockHeight, snapshot.blockTime);
        });

        const result = await commonQuery(sql, params);
        return (result as any).affectedRows;
    } catch (error) {
        console.error("Error batch creating snapshots:", error);
        return 0;
    }
}

/**
 * 根据区块高度获取快照
 */
export async function getSnapshotByBlockHeight(blockHeight: number, type?: SnapShotType): Promise<SnapshotInfo | null> {
    try {
        let sql = `
            SELECT id, timestamp, type, blockHeight, blockTime
            FROM snapshot_info
            WHERE blockHeight = ?
        `;
        const params: any[] = [blockHeight];

        if (type) {
            sql += ` AND type = ?`;
            params.push(type);
        }

        sql += ` ORDER BY timestamp DESC LIMIT 1`;

        const result = await commonQuery<SnapshotInfo>(sql, params);
        return result[0] || null;
    } catch (error) {
        console.error("Error getting snapshot by block height:", error);
        return null;
    }
}



