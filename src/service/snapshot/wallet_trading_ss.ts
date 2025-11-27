import { WalletTradingSnapshotRepository } from "../../database/repositories";
import { SnapShotForWalletTrading } from "../../type/transaction";

// 批量插入配置
const BATCH_INSERT_CONFIG = {
    BATCH_SIZE: 1000,
    BATCH_DELAY_MS: parseInt(process.env.BATCH_INSERT_DELAY_MS || '100'),
} as const;

/**
 * 将 SnapShotForWalletTrading 转换为数据库格式
 */
function convertToDatabaseFormat(snapshot: SnapShotForWalletTrading) {
    // 处理时间转换
    let snapshotTime: Date;
    const timeStr = String(snapshot.snapshotTime || '');
    
    if (!snapshot.snapshotTime || timeStr.trim() === '') {
        snapshotTime = new Date();
    } else {
        const timestampNum = parseInt(timeStr);
        if (!isNaN(timestampNum) && timeStr === timestampNum.toString()) {
            // Unix 时间戳
            snapshotTime = new Date(timestampNum > 1e12 ? timestampNum : timestampNum * 1000);
        } else {
            snapshotTime = new Date(timeStr);
        }
        
        if (isNaN(snapshotTime.getTime())) {
            snapshotTime = new Date();
        }
    }

    // 安全数值转换
    const safeNumber = (value: number, fallback: number = 0): string => {
        if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
            return String(fallback);
        }
        return String(value);
    };

    // 处理blockHeight，确保不是NaN
    const blockHeight = snapshot.blockHeight !== undefined && 
                       !isNaN(snapshot.blockHeight) && 
                       snapshot.blockHeight !== null 
                       ? snapshot.blockHeight 
                       : null;

    return {
        walletAddress: snapshot.walletAddress,
        snapshotTime,
        blockHeight,
        perTLTradingValue: snapshot.perTLTradingValue,
        totalBuySolAmount: safeNumber(snapshot.totalBuySolAmount),
        totalBuyUsdAmount: safeNumber(snapshot.totalBuyUsdAmount),
        totalSellSolAmount: safeNumber(snapshot.totalSellSolAmount),
        totalSellUsdAmount: safeNumber(snapshot.totalSellUsdAmount),
        buyCount: Math.floor(snapshot.buy_count || 0),
        sellCount: Math.floor(snapshot.sell_count || 0),
        solPrice: safeNumber(snapshot.solPrice),
        winCount: Math.floor(snapshot.winCount || 0),
        loseCount: Math.floor(snapshot.loseCount || 0),
        currentTokenValue: snapshot.currentTokenValue,
    };
}

/**
 * 创建新的钱包交易快照记录
 */
export async function createWalletTradingSnapshot(snapshot: SnapShotForWalletTrading): Promise<SnapShotForWalletTrading | null> {
    try {
        const dbData = convertToDatabaseFormat(snapshot);
        const result = await WalletTradingSnapshotRepository.create(dbData);
        
        if (result) {
            return {
                ...snapshot,
                snapshotTime: result.snapshotTime.toISOString(),
            };
        }
    } catch (error) {
        console.error("Error creating wallet trading snapshot:", error);
    }
    return null;
}

/**
 * 批量创建钱包交易快照记录
 */
export async function batchCreateWalletTradingSnapshots(snapshots: SnapShotForWalletTrading[]): Promise<number> {
    if (snapshots.length === 0) return 0;

    try {
        const batchSize = BATCH_INSERT_CONFIG.BATCH_SIZE;
        const totalBatches = Math.ceil(snapshots.length / batchSize);
        
        console.log(`📊 开始批量插入 ${snapshots.length} 条钱包快照记录，分 ${totalBatches} 批次`);

        let totalInserted = 0;

        for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
            const start = batchNumber * batchSize;
            const end = Math.min(start + batchSize, snapshots.length);
            const batchSnapshots = snapshots.slice(start, end);

            console.log(`📝 处理批次 ${batchNumber + 1}/${totalBatches}: ${batchSnapshots.length} 条记录`);

            const dbDataList = batchSnapshots.map(convertToDatabaseFormat);
            const count = await WalletTradingSnapshotRepository.batchCreate(dbDataList);
            totalInserted += count;

            if (batchNumber < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, BATCH_INSERT_CONFIG.BATCH_DELAY_MS));
            }
        }

        console.log(`✅ 成功插入 ${totalInserted} 条记录`);
        return totalInserted;
    } catch (error) {
        console.error("Error batch creating wallet trading snapshots:", error);
        return 0;
    }
}

/**
 * 根据 ID 获取钱包交易快照
 */
export async function getWalletTradingSnapshotById(id: number): Promise<SnapShotForWalletTrading | null> {
    try {
        const result = await WalletTradingSnapshotRepository.findById(BigInt(id));
        if (result) {
            return {
                walletAddress: result.walletAddress,
                snapshotTime: result.snapshotTime.toISOString(),
                blockHeight: result.blockHeight || undefined,
                perTLTradingValue: result.perTLTradingValue as any,
                totalBuySolAmount: Number(result.totalBuySolAmount),
                totalBuyUsdAmount: Number(result.totalBuyUsdAmount),
                totalSellSolAmount: Number(result.totalSellSolAmount),
                totalSellUsdAmount: Number(result.totalSellUsdAmount),
                buy_count: result.buyCount,
                sell_count: result.sellCount,
                solPrice: Number(result.solPrice),
                winCount: result.winCount,
                loseCount: result.loseCount,
                currentTokenValue: result.currentTokenValue as any,
            };
        }
    } catch (error) {
        console.error("Error getting wallet trading snapshot by id:", error);
    }
    return null;
}

/**
 * 获取钱包的最新交易快照
 */
export async function getLatestWalletTradingSnapshot(walletAddress: string): Promise<SnapShotForWalletTrading | null> {
    try {
        const result = await WalletTradingSnapshotRepository.findLatestByWallet(walletAddress);
        if (result) {
            return {
                walletAddress: result.walletAddress,
                snapshotTime: result.snapshotTime.toISOString(),
                blockHeight: result.blockHeight || undefined,
                perTLTradingValue: result.perTLTradingValue as any,
                totalBuySolAmount: Number(result.totalBuySolAmount),
                totalBuyUsdAmount: Number(result.totalBuyUsdAmount),
                totalSellSolAmount: Number(result.totalSellSolAmount),
                totalSellUsdAmount: Number(result.totalSellUsdAmount),
                buy_count: result.buyCount,
                sell_count: result.sellCount,
                solPrice: Number(result.solPrice),
                winCount: result.winCount,
                loseCount: result.loseCount,
                currentTokenValue: result.currentTokenValue as any,
            };
        }
    } catch (error) {
        console.error("Error getting latest wallet trading snapshot:", error);
    }
    return null;
}

/**
 * 获取指定钱包在指定时间之前的最后一次快照
 */
export async function getLatestWalletTradingSnapshotBeforeTime(
    walletAddress: string, 
    timestamp: number
): Promise<SnapShotForWalletTrading | null> {
    try {
        const timestampDate = new Date(timestamp * 1000);
        const result = await WalletTradingSnapshotRepository.findLatestBeforeTime(walletAddress, timestampDate);
        
        if (result) {
            return {
                walletAddress: result.walletAddress,
                snapshotTime: result.snapshotTime.toISOString(),
                blockHeight: result.blockHeight || undefined,
                perTLTradingValue: result.perTLTradingValue as any,
                totalBuySolAmount: Number(result.totalBuySolAmount),
                totalBuyUsdAmount: Number(result.totalBuyUsdAmount),
                totalSellSolAmount: Number(result.totalSellSolAmount),
                totalSellUsdAmount: Number(result.totalSellUsdAmount),
                buy_count: result.buyCount,
                sell_count: result.sellCount,
                solPrice: Number(result.solPrice),
                winCount: result.winCount,
                loseCount: result.loseCount,
                currentTokenValue: result.currentTokenValue as any,
            };
        }
    } catch (error) {
        console.error("Error getting latest wallet trading snapshot before time:", error);
    }
    return null;
}

/**
 * 批量获取指定钱包在指定时间之前的最后一次快照
 */
export async function batchGetLatestWalletTradingSnapshotBeforeTime(
    walletAddresses: string[],
    timestamp: number
): Promise<Map<string, SnapShotForWalletTrading>> {
    const result = new Map<string, SnapShotForWalletTrading>();

    if (walletAddresses.length === 0) {
        return result;
    }

    try {
        const timestampDate = new Date(timestamp * 1000);
        const snapshotsMap = await WalletTradingSnapshotRepository.batchFindLatestBeforeTime(
            walletAddresses,
            timestampDate
        );

        for (const [walletAddress, snapshot] of snapshotsMap) {
            result.set(walletAddress, {
                walletAddress: snapshot.walletAddress,
                snapshotTime: snapshot.snapshotTime.toISOString(),
                blockHeight: snapshot.blockHeight || undefined,
                perTLTradingValue: snapshot.perTLTradingValue as any,
                totalBuySolAmount: Number(snapshot.totalBuySolAmount),
                totalBuyUsdAmount: Number(snapshot.totalBuyUsdAmount),
                totalSellSolAmount: Number(snapshot.totalSellSolAmount),
                totalSellUsdAmount: Number(snapshot.totalSellUsdAmount),
                buy_count: snapshot.buyCount,
                sell_count: snapshot.sellCount,
                solPrice: Number(snapshot.solPrice),
                winCount: snapshot.winCount,
                loseCount: snapshot.loseCount,
                currentTokenValue: snapshot.currentTokenValue as any,
            });
        }

        console.log(`📊 批量查询 ${walletAddresses.length} 个钱包，找到 ${result.size} 个历史快照`);
    } catch (error) {
        console.error("Error batch getting latest wallet trading snapshots before time:", error);
    }

    return result;
}

/**
 * 保存钱包交易快照数据（批量）
 */
export async function saveWalletTradingSnapshots(snapshots: SnapShotForWalletTrading[]): Promise<boolean> {
    try {
        if (snapshots.length === 0) return false;
        
        const dbDataList = snapshots.map(convertToDatabaseFormat);
        const success = await WalletTradingSnapshotRepository.saveSnapshots(dbDataList);
        
        if (success) {
            console.log(`✅ 成功保存 ${snapshots.length} 条钱包快照`);
        }
        
        return success;
    } catch (error) {
        console.error("Error saving wallet trading snapshots:", error);
        return false;
    }
}

/**
 * 更新钱包交易快照
 */
export async function updateWalletTradingSnapshot(
    id: number,
    updateData: Partial<SnapShotForWalletTrading>
): Promise<boolean> {
    try {
        const dbUpdate: any = {};
        
        if (updateData.snapshotTime !== undefined) {
            const timeStr = String(updateData.snapshotTime);
            dbUpdate.snapshotTime = new Date(timeStr);
        }
        
        if (updateData.perTLTradingValue !== undefined) {
            dbUpdate.perTLTradingValue = updateData.perTLTradingValue;
        }

        const result = await WalletTradingSnapshotRepository.update(BigInt(id), dbUpdate);
        return !!result;
    } catch (error) {
        console.error(`Error updating wallet trading snapshot ${id}:`, error);
        return false;
    }
}

export async function deleteWalletTradingSnapshot(id: number): Promise<boolean> {
    try {
        return await WalletTradingSnapshotRepository.delete(BigInt(id));
    } catch (error) {
        console.error(`Error deleting wallet trading snapshot ${id}:`, error);
        return false;
    }
}
