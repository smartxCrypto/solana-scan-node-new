import { SnapshotInfoRepository } from "../../database/repositories";
import { SnapshotInfo, SnapShotType } from "../../type/snapshot";
import type { SnapshotInfo as DbSnapshotInfo } from "../../database/schema/snapshot-info";
import { toSafeNumber } from "@/lib/node-utils";

/**
 * 将数据库记录转换为业务层格式
 */
function mapDbToSnapshot(dbSnapshot: DbSnapshotInfo): SnapshotInfo {
    return {
        id: dbSnapshot.id,
        timestamp: Number(dbSnapshot.timestamp),
        type: dbSnapshot.type as SnapShotType,
        blockHeight: Number(dbSnapshot.blockHeight),
        blockTime: Number(dbSnapshot.blockTime),
    };
}

/**
 * 创建新的快照记录
 */
export async function createSnapshot(snapshotData: Omit<SnapshotInfo, 'id'>): Promise<number | null> {
    try {
        const result = await SnapshotInfoRepository.create({
            timestamp: toSafeNumber(snapshotData.timestamp),
            type: snapshotData.type as 'TokenNormSnapShot' | 'SnapShotForWalletTrading',
            blockHeight: toSafeNumber(snapshotData.blockHeight),
            blockTime: toSafeNumber(snapshotData.blockTime),
        });
        return result.id;
    } catch (error) {
        console.error("Error creating snapshot:", error);
        return null;
    }
}

/**
 * 根据 ID 获取快照信息
 */
export async function getSnapshotById(id: number): Promise<SnapshotInfo | null> {
    try {
        const result = await SnapshotInfoRepository.findById(id);
        return result ? mapDbToSnapshot(result) : null;
    } catch (error) {
        console.error("Error getting snapshot by id:", error);
        return null;
    }
}

/**
 * 根据类型获取最近的一次快照数据
 */
export async function getLatestSnapshotByType(type: SnapShotType): Promise<SnapshotInfo | null> {
    try {
        const result = await SnapshotInfoRepository.findLatestByType(
            type as 'TokenNormSnapShot' | 'SnapShotForWalletTrading'
        );
        return result ? mapDbToSnapshot(result) : null;
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
        const results = await SnapshotInfoRepository.findByType(
            type as 'TokenNormSnapShot' | 'SnapShotForWalletTrading',
            page,
            pageSize
        );
        return results.map(mapDbToSnapshot);
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
        const results = await SnapshotInfoRepository.findByTimeRange(
            startTimestamp,
            endTimestamp,
            type as 'TokenNormSnapShot' | 'SnapShotForWalletTrading' | undefined
        );
        return results.map(mapDbToSnapshot);
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
        const dbUpdateData: any = {};

        if (updateData.timestamp !== undefined) {
            dbUpdateData.timestamp = BigInt(updateData.timestamp);
        }
        if (updateData.type !== undefined) {
            dbUpdateData.type = updateData.type;
        }
        if (updateData.blockHeight !== undefined) {
            dbUpdateData.blockHeight = BigInt(updateData.blockHeight);
        }
        if (updateData.blockTime !== undefined) {
            dbUpdateData.blockTime = BigInt(updateData.blockTime);
        }

        const result = await SnapshotInfoRepository.update(id, dbUpdateData);
        return result !== undefined;
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
        return await SnapshotInfoRepository.delete(id);
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
        return await SnapshotInfoRepository.count(
            type as 'TokenNormSnapShot' | 'SnapShotForWalletTrading' | undefined
        );
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
        const dbSnapshots = snapshots.map(s => ({
            timestamp: toSafeNumber(s.timestamp),
            type: s.type as 'TokenNormSnapShot' | 'SnapShotForWalletTrading',
            blockHeight: toSafeNumber(s.blockHeight),
            blockTime: toSafeNumber(s.blockTime),
        }));

        return await SnapshotInfoRepository.batchCreate(dbSnapshots);
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
        const result = await SnapshotInfoRepository.findByBlockHeight(
            blockHeight,
            type as 'TokenNormSnapShot' | 'SnapShotForWalletTrading' | undefined
        );
        return result ? mapDbToSnapshot(result) : null;
    } catch (error) {
        console.error("Error getting snapshot by block height:", error);
        return null;
    }
}

