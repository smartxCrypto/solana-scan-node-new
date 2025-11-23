import * as cron from 'node-cron';
import { updateEmptySolScanImageTokens } from '@/scan/token_metadata_update';

/**
 * Token Metadata 更新定时任务
 * 每3分钟检查一次数据库中 sol_scan_image 为空的 token 数据并进行补全
 */
class TokenMetadataUpdateScheduler {
    private isRunning: boolean = false;
    
    constructor() {
        this.setupCronJob();
    }

    /**
     * 设置定时任务 - 每3分钟执行一次
     */
    private setupCronJob(): void {
        // 每3分钟执行一次: '*/3 * * * *'
        cron.schedule('*/3 * * * *', async () => {
            if (this.isRunning) {
                console.log("⏸️  Token metadata 更新任务正在运行中，跳过本次执行");
                return;
            }

            try {
                this.isRunning = true;
                console.log(`\n🚀 [${new Date().toISOString()}] 开始执行 Token Metadata 更新任务...`);
                
                const result = await updateEmptySolScanImageTokens();
                
                console.log(`✅ [${new Date().toISOString()}] Token Metadata 更新任务完成`);
                console.log(`📈 本次任务统计: 处理 ${result.processedCount} 个，成功 ${result.successCount} 个，失败 ${result.failedCount} 个`);
                
                // 如果没有需要处理的数据了，可以适当调整频率提示
                if (result.totalEmptyTokens === 0) {
                    console.log("🎉 当前没有需要补全 sol_scan_image 的 token 数据");
                }
                
            } catch (error) {
                console.error(`❌ [${new Date().toISOString()}] Token Metadata 更新任务执行失败:`, error);
            } finally {
                this.isRunning = false;
            }
        }, {
            timezone: "UTC"
        });

        console.log("⏰ Token Metadata 更新定时任务已启动 (每3分钟执行一次)");
    }

    /**
     * 手动执行一次更新任务
     */
    public async runOnce(): Promise<void> {
        if (this.isRunning) {
            console.log("⏸️  任务正在运行中，请稍后再试");
            return;
        }

        try {
            this.isRunning = true;
            console.log(`🚀 [${new Date().toISOString()}] 手动执行 Token Metadata 更新任务...`);
            
            const result = await updateEmptySolScanImageTokens();
            
            console.log(`✅ [${new Date().toISOString()}] 手动执行完成`);
            console.log(`📈 任务统计: 处理 ${result.processedCount} 个，成功 ${result.successCount} 个，失败 ${result.failedCount} 个`);
            
        } catch (error) {
            console.error(`❌ [${new Date().toISOString()}] 手动执行失败:`, error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 获取任务运行状态
     */
    public getStatus(): { isRunning: boolean } {
        return { isRunning: this.isRunning };
    }
}

// 创建并导出调度器实例
const tokenMetadataUpdateScheduler = new TokenMetadataUpdateScheduler();

// 导出实例和类，方便其他地方使用
export { tokenMetadataUpdateScheduler, TokenMetadataUpdateScheduler };

// 如果直接运行此文件，启动定时任务
if (require.main === module) {
    console.log("🎯 Token Metadata 更新定时任务服务启动中...");
    
    // 可选：启动时立即执行一次
    // tokenMetadataUpdateScheduler.runOnce();
    
    // 保持进程运行
    process.on('SIGINT', () => {
        console.log("\n📴 接收到终止信号，正在关闭 Token Metadata 更新服务...");
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log("\n📴 接收到终止信号，正在关闭 Token Metadata 更新服务...");
        process.exit(0);
    });
    
    console.log("✅ Token Metadata 更新定时任务服务已启动，按 Ctrl+C 退出");
}
