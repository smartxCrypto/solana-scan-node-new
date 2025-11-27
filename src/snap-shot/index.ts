import { SNAP_SHOT_CONFIG } from "../constant/config";
import { getLatestSnapshotByType, createSnapshot } from "../service/snapshot/snapshot";
import { saveTokenSnapshots } from "../service/snapshot/token_ss";
import { saveWalletTradingSnapshots } from "../service/snapshot/wallet_trading_ss";
import { SolanaBlockDataHandler } from "../service/SolanaBlockDataHandler";
import { SnapShotType } from "../type/snapshot";
import { TokenSwapFilterData } from "../type/swap";
import { snapshotTokenValueByTxData } from "./token/index";
import { snapshotWalletTradingByTxDataOptimized } from "./wallet-trading/index";

export const filterSwapDataForTokenTrading = async (txData: TokenSwapFilterData[]) => {
    const tokenSnapShotData = snapshotTokenValueByTxData(txData);
    return tokenSnapShotData;
}

const filterSwapDataForWalletTrading = async (txData: TokenSwapFilterData[]) => {
    const walletSnapShotData = await snapshotWalletTradingByTxDataOptimized(txData);
    return walletSnapShotData;
}

/**
 * 基于区块高度范围获取Token和Wallet交易数据进行快照
 */
const getTokenAndWalletTradingDataByBlockRange = async (startBlockHeight: number, endBlockHeight: number) => {
    const txData = await SolanaBlockDataHandler.getDataByBlockHeightRange(startBlockHeight, endBlockHeight);

    const filterData = SolanaBlockDataHandler.filterTokenData(txData);

    const tokenSnapShotData = await filterSwapDataForTokenTrading(filterData);
    const walletSnapShotData = await filterSwapDataForWalletTrading(filterData);

    // 为快照数据设置区块高度（使用endBlockHeight）
    tokenSnapShotData.forEach(snapshot => {
        snapshot.blockHeight = endBlockHeight;
    });
    
    walletSnapShotData.forEach(snapshot => {
        snapshot.blockHeight = endBlockHeight;
    });

    return {
        tokenSnapShotData,
        walletSnapShotData
    }
}

/**
 * 生成区块高度窗口列表
 */
function generateBlockWindows(startBlockHeight: number, endBlockHeight: number, blocksPerWindow: number): Array<{ start: number, end: number }> {
    const windows: Array<{ start: number, end: number }> = [];
    let current = startBlockHeight;

    while (current <= endBlockHeight) {
        const windowEnd = Math.min(current + blocksPerWindow - 1, endBlockHeight);
        windows.push({
            start: current,
            end: windowEnd
        });
        current = windowEnd + 1;
    }

    return windows;
}

/**
 * 基于区块高度的快照函数 - 按区块高度窗口分段处理
 * @param startBlockHeight 起始区块高度
 * @param endBlockHeight 结束区块高度
 */
const SnapshotForTokenAndWalletTrading = async (startBlockHeight: number, endBlockHeight: number): Promise<{
    tokenSnapShot: boolean;
    walletSnapShot: boolean;
    processedWindows: number;
    message: string;
}> => {
    try {
        const startTime = Date.now();
        const BLOCKS_PER_SNAPSHOT = SNAP_SHOT_CONFIG.BLOCKS_PER_SNAPSHOT;

        console.log(`Starting block-based snapshot processing: blocks ${startBlockHeight} -> ${endBlockHeight}`);

        // 验证输入参数
        if (startBlockHeight >= endBlockHeight) {
            return {
                tokenSnapShot: false,
                walletSnapShot: false,
                processedWindows: 0,
                message: "Invalid block height range: start block must be less than end block"
            };
        }

        // 基于区块高度生成窗口列表
        const blockWindows = generateBlockWindows(startBlockHeight, endBlockHeight, BLOCKS_PER_SNAPSHOT);

        if (blockWindows.length === 0) {
            return {
                tokenSnapShot: false,
                walletSnapShot: false,
                processedWindows: 0,
                message: "No block windows to process"
            };
        }

        let processedWindows = 0;
        let totalTokenSnapshots = 0;
        let totalWalletSnapshots = 0;

        // 性能统计
        let totalSnapshotProcessTime = 0;
        let totalDbSaveTime = 0;

        // 逐个处理区块窗口
        for (let i = 0; i < blockWindows.length; i++) {
            const window = blockWindows[i];
            const windowStartTime = Date.now();

            console.log(`Processing window ${i + 1}/${blockWindows.length}: blocks ${window.start}-${window.end}`);

            // 直接获取该区块窗口范围内的所有数据，取消分页
            const dataProcessStartTime = Date.now();
            const { tokenSnapShotData, walletSnapShotData } = await getTokenAndWalletTradingDataByBlockRange(
                window.start,
                window.end
            );
            const dataProcessEndTime = Date.now();
            totalSnapshotProcessTime += (dataProcessEndTime - dataProcessStartTime);

            // 立即处理并保存当前窗口的数据
            let windowTokenSnapshotsSaved = 0;
            let windowWalletSnapshotsSaved = 0;

            const dbSaveStartTime = Date.now();
            // 保存Token快照数据
            if (tokenSnapShotData.length > 0) {
                const tokenSuccess = await saveTokenSnapshots(tokenSnapShotData);
                if (tokenSuccess) {
                    windowTokenSnapshotsSaved = tokenSnapShotData.length;
                    totalTokenSnapshots += windowTokenSnapshotsSaved;

                    // 记录Token快照的区块高度节点到数据库
                    await createSnapshot({
                        timestamp: Math.floor(Date.now() / 1000),
                        type: SnapShotType.TokenNormSnapShot,
                        blockHeight: window.end,
                        blockTime: Math.floor(Date.now() / 1000)
                    });
                }
            }

            // 保存Wallet快照数据
            if (walletSnapShotData.length > 0) {
                const walletSuccess = await saveWalletTradingSnapshots(walletSnapShotData);
                if (walletSuccess) {
                    windowWalletSnapshotsSaved = walletSnapShotData.length;
                    totalWalletSnapshots += windowWalletSnapshotsSaved;

                    // 记录Wallet快照的区块高度节点到数据库
                    await createSnapshot({
                        timestamp: Math.floor(Date.now() / 1000),
                        type: SnapShotType.SnapShotForWalletTrading,
                        blockHeight: window.end,
                        blockTime: Math.floor(Date.now() / 1000)
                    });
                }
            }
            const dbSaveEndTime = Date.now();
            totalDbSaveTime += (dbSaveEndTime - dbSaveStartTime);

            processedWindows++;
            const windowEndTime = Date.now();
            const windowTotalTime = windowEndTime - windowStartTime;

            console.log(`Window ${i + 1} completed: ${windowTokenSnapshotsSaved} tokens, ${windowWalletSnapshotsSaved} wallets (${windowTotalTime}ms)`);
        }

        const totalProcessTime = Date.now() - startTime;
        console.log(`Snapshot processing completed: ${processedWindows} windows, ${totalTokenSnapshots} token snapshots, ${totalWalletSnapshots} wallet snapshots (${totalProcessTime}ms)`);

        return {
            tokenSnapShot: totalTokenSnapshots > 0,
            walletSnapShot: totalWalletSnapshots > 0,
            processedWindows,
            message: `Successfully processed ${processedWindows} block windows, generated ${totalTokenSnapshots} token snapshots and ${totalWalletSnapshots} wallet snapshots`
        };

    } catch (error) {
        console.error("Error in block snapshot processing:", error);
        return {
            tokenSnapShot: false,
            walletSnapShot: false,
            processedWindows: 0,
            message: `Block snapshot processing failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

export { SnapshotForTokenAndWalletTrading };