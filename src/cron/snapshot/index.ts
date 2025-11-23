import { SolanaBlockUtil } from "../../utils/SolanaBlockUtil";
import { SolanaBlockDataHandler } from "../../service/SolanaBlockDataHandler";
import { getLatestSnapshotByType } from "../../service/snapshot/snapshot";
import { SnapshotForTokenAndWalletTrading } from "../../snap-shot/index";
import { SnapShotType } from "../../type/snapshot";
import { SNAP_SHOT_CONFIG } from "../../constant/config";

export class SnapshotScheduler {
    private isRunning = false;
    private readonly BLOCKS_PER_SNAPSHOT = SNAP_SHOT_CONFIG.BLOCKS_PER_SNAPSHOT; // 每50个区块进行一次快照
    private readonly SAFETY_BUFFER = SNAP_SHOT_CONFIG.SAFETY_BUFFER; // 安全缓冲区，不处理最新的10个区块

    public async start(): Promise<void> {
        this.isRunning = true;
        console.log(`Snapshot scheduler started: ${this.BLOCKS_PER_SNAPSHOT} blocks per snapshot`);

        while (this.isRunning) {
            try {
                await this.processSnapshots();
                // 等待30秒后再次检查
                await this.delay(30000);
            } catch (err) {
                console.error("Snapshot scheduler error:", err);
                await this.delay(10000); // 错误时等待10秒重试
            }
        }
    }

    public stop(): void {
        this.isRunning = false;
        console.log("Snapshot scheduler stopped");
    }

    private async processSnapshots(): Promise<void> {
        // 1. 获取当前最新区块高度
        const latestHeight = await SolanaBlockUtil.getLatestSlot();
        const safeLatestHeight = latestHeight - this.SAFETY_BUFFER; // 留出安全缓冲区

        // 2. 获取上次快照的区块高度
        const lastSnapshotHeight = await this.getLastSnapshotHeight();

        // 3. 计算需要处理的区块范围
        const startHeight = lastSnapshotHeight + 1;
        const endHeight = safeLatestHeight;

        if (startHeight > endHeight) {
            // 没有新的区块需要处理
            return;
        }

        console.log(`Checking snapshot range: ${startHeight} -> ${endHeight} (latest: ${latestHeight})`);

        // 4. 按50个区块分组处理
        const snapshotWindows = this.generateSnapshotWindows(startHeight, endHeight);

        if (snapshotWindows.length === 0) {
            return;
        }

        console.log(`Found ${snapshotWindows.length} snapshot windows to process`);

        // 5. 逐个处理快照窗口
        for (const window of snapshotWindows) {
            await this.processSnapshotWindow(window);

            // 每个窗口处理完后稍作延迟，避免过于频繁
            await this.delay(1000);
        }
    }

    private async getLastSnapshotHeight(): Promise<number> {
        try {
            // 先尝试获取Wallet快照的最新区块高度
            const walletSnapshot = await getLatestSnapshotByType(SnapShotType.SnapShotForWalletTrading);
            if (walletSnapshot && walletSnapshot.blockHeight) {
                console.log(`Last wallet snapshot at block: ${walletSnapshot.blockHeight}`);
                return walletSnapshot.blockHeight;
            }

            // 如果没有Wallet快照，尝试获取Token快照的最新区块高度
            const tokenSnapshot = await getLatestSnapshotByType(SnapShotType.TokenNormSnapShot);
            if (tokenSnapshot && tokenSnapshot.blockHeight) {
                console.log(`Last token snapshot at block: ${tokenSnapshot.blockHeight}`);
                return tokenSnapshot.blockHeight;
            }

            // 如果都没有快照记录，从交易数据中获取最小区块高度
            const minBlockHeight = await this.getMinimumBlockHeightFromSwapData();
            console.log(`No previous snapshots found, starting from block: ${minBlockHeight}`);
            return minBlockHeight - 1; // 减1是因为后续会+1作为起始点
        } catch (error) {
            console.error("Error getting last snapshot height:", error);
            // 发生错误时，从交易数据的最小区块开始
            const minBlockHeight = await this.getMinimumBlockHeightFromSwapData();
            return minBlockHeight - 1;
        }
    }

    private async getMinimumBlockHeightFromSwapData(): Promise<number> {
        try {
            // 直接从swap交易表中获取最小的区块高度
            // 由于没有现成的方法，我们可以获取一些早期数据来推断最小区块高度
            const earlyData = await SolanaBlockDataHandler.getXDaysData(0, 1);
            if (earlyData && earlyData.length > 0 && earlyData[0].block_height) {
                return earlyData[0].block_height;
            }

            // 如果获取不到，返回一个合理的默认值
            console.warn("Could not get minimum block height from swap data, using default");
            return 1; // 默认从区块1开始
        } catch (error) {
            console.error("Error getting minimum block height from swap data:", error);
            return 1; // 出错时返回默认值
        }
    }

    private generateSnapshotWindows(startHeight: number, endHeight: number): Array<{ start: number, end: number }> {
        const windows: Array<{ start: number, end: number }> = [];
        let current = startHeight;

        while (current <= endHeight) {
            const windowEnd = Math.min(current + this.BLOCKS_PER_SNAPSHOT - 1, endHeight);

            // 只有当窗口包含完整的50个区块时才处理（除非是最后一个窗口）
            const windowSize = windowEnd - current + 1;
            if (windowSize >= this.BLOCKS_PER_SNAPSHOT || windowEnd === endHeight) {
                windows.push({
                    start: current,
                    end: windowEnd
                });
            }

            current = windowEnd + 1;
        }

        return windows;
    }

    private async processSnapshotWindow(window: { start: number, end: number }): Promise<void> {
        try {
            console.log(`Processing snapshot window: blocks ${window.start}-${window.end}`);

            const startTime = Date.now();

            // 执行快照处理
            const result = await SnapshotForTokenAndWalletTrading(window.start, window.end);

            const duration = Date.now() - startTime;

            if (result.tokenSnapShot || result.walletSnapShot) {
                console.log(`Snapshot window completed successfully: ${result.message} (${duration}ms)`);
            } else {
                console.warn(`Snapshot window failed: ${result.message} (${duration}ms)`);
            }
        } catch (error) {
            console.error(`Error processing snapshot window ${window.start}-${window.end}:`, error);
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 创建并启动快照调度器实例
const snapshotScheduler = new SnapshotScheduler();

// 导出调度器实例，以便在需要时可以停止
export { snapshotScheduler };