import { TokenSnapshotRepository } from "../../database/repositories";
import { TokenNormSnapShot } from "../../type/transaction";

/**
 * 将 TokenNormSnapShot 转换为数据库格式
 */
function convertToDatabaseFormat(snapshot: TokenNormSnapShot) {
    const blockHeight = isNaN(snapshot.blockHeight) || snapshot.blockHeight === undefined ? 0 : snapshot.blockHeight;
    const snapShotBlockTime = isNaN(snapshot.snapShotBlockTime) || snapshot.snapShotBlockTime === undefined ? 0 : snapshot.snapShotBlockTime;
    
    return {
        blockHeight: blockHeight,
        blockTime: new Date(snapshot.blockTime),
        tokenAddress: snapshot.tokenAddress,
        buyAmount: String(snapshot.buyAmount || 0),
        sellAmount: String(snapshot.sellAmount || 0),
        buyCount: snapshot.buyCount || 0,
        sellCount: snapshot.sellCount || 0,
        highPrice: String(snapshot.highPrice || 0),
        lowPrice: String(snapshot.lowPrice || 0),
        startPrice: String(snapshot.startPrice || 0),
        endPrice: String(snapshot.endPrice || 0),
        avgPrice: String(snapshot.avgPrice || 0),
        poolAddress: snapshot.poolAddress || null,
        snapShotBlockTime: snapShotBlockTime,
    };
}

/**
 * 创建代币快照
 */
export async function createTokenSnapshot(snapshot: TokenNormSnapShot): Promise<number | null> {
    try {
        const dbData = convertToDatabaseFormat(snapshot);
        const result = await TokenSnapshotRepository.create(dbData);
        return Number(result.id);
    } catch (error) {
        console.error("Error creating token snapshot:", error);
        return null;
    }
}

/**
 * 批量创建代币快照
 */
export async function batchCreateTokenSnapshots(snapshots: TokenNormSnapShot[]): Promise<number> {
    if (snapshots.length === 0) return 0;

    try {
        const dbDataList = snapshots.map(convertToDatabaseFormat);
        return await TokenSnapshotRepository.batchCreate(dbDataList);
    } catch (error) {
        console.error("Error batch creating token snapshots:", error);
        return 0;
    }
}

/**
 * 根据代币地址获取最新快照
 */
export async function getLatestTokenSnapshot(tokenAddress: string): Promise<TokenNormSnapShot | null> {
    try {
        const result = await TokenSnapshotRepository.findLatestByToken(tokenAddress);
        if (result) {
            return {
                blockHeight: result.blockHeight,
                blockTime: result.blockTime.toISOString(),
                tokenAddress: result.tokenAddress,
                buyAmount: Number(result.buyAmount),
                sellAmount: Number(result.sellAmount),
                buyCount: result.buyCount,
                sellCount: result.sellCount,
                highPrice: Number(result.highPrice),
                lowPrice: Number(result.lowPrice),
                startPrice: Number(result.startPrice),
                endPrice: Number(result.endPrice),
                avgPrice: Number(result.avgPrice),
                poolAddress: result.poolAddress || '',
                snapShotBlockTime: result.snapShotBlockTime,
            };
        }
    } catch (error) {
        console.error("Error getting latest token snapshot:", error);
    }
    return null;
}

/**
 * 获取代币的快照列表（分页）
 */
export async function getTokenSnapshots(
    tokenAddress: string,
    page: number = 1,
    pageSize: number = 50
): Promise<TokenNormSnapShot[]> {
    try {
        const results = await TokenSnapshotRepository.findByToken(tokenAddress, page, pageSize);
        
        return results.map(result => ({
            blockHeight: result.blockHeight,
            blockTime: result.blockTime.toISOString(),
            tokenAddress: result.tokenAddress,
            buyAmount: Number(result.buyAmount),
            sellAmount: Number(result.sellAmount),
            buyCount: result.buyCount,
            sellCount: result.sellCount,
            highPrice: Number(result.highPrice),
            lowPrice: Number(result.lowPrice),
            startPrice: Number(result.startPrice),
            endPrice: Number(result.endPrice),
            avgPrice: Number(result.avgPrice),
            poolAddress: result.poolAddress || '',
            snapShotBlockTime: result.snapShotBlockTime,
        }));
    } catch (error) {
        console.error("Error getting token snapshots:", error);
        return [];
    }
}

/**
 * 保存代币快照数据（批量）
 */
export async function saveTokenSnapshots(snapshots: TokenNormSnapShot[]): Promise<boolean> {
    try {
        if (snapshots.length === 0) return false;
        
        const dbDataList = snapshots.map(convertToDatabaseFormat);
        return await TokenSnapshotRepository.saveSnapshots(dbDataList);
    } catch (error) {
        console.error("Error saving token snapshots:", error);
        return false;
    }
}

/**
 * 根据区块范围获取代币快照
 */
export async function getTokenSnapshotsByBlockRange(
    tokenAddress: string,
    startBlockHeight: number,
    endBlockHeight: number
): Promise<TokenNormSnapShot[]> {
    try {
        const results = await TokenSnapshotRepository.findByBlockRange(
            startBlockHeight,
            endBlockHeight,
            tokenAddress
        );

        return results.map(result => ({
            blockHeight: result.blockHeight,
            blockTime: result.blockTime.toISOString(),
            tokenAddress: result.tokenAddress,
            buyAmount: Number(result.buyAmount),
            sellAmount: Number(result.sellAmount),
            buyCount: result.buyCount,
            sellCount: result.sellCount,
            highPrice: Number(result.highPrice),
            lowPrice: Number(result.lowPrice),
            startPrice: Number(result.startPrice),
            endPrice: Number(result.endPrice),
            avgPrice: Number(result.avgPrice),
            poolAddress: result.poolAddress || '',
            snapShotBlockTime: result.snapShotBlockTime,
        }));
    } catch (error) {
        console.error("Error getting token snapshots by block range:", error);
        return [];
    }
}

