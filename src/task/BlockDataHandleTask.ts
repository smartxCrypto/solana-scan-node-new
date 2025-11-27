import {SolanaBlockDataHandler} from "@/service/SolanaBlockDataHandler";

// 检测是否在 PM2 环境中
const isPM2 = process.env.pm_id !== undefined;

// 启动消费者（异步执行，不阻塞）
// 在 PM2 集群模式下，每个实例都会启动，添加小延迟避免同时启动
const startDelay = isPM2 ? Math.random() * 1000 : 0;

setTimeout(() => {
    SolanaBlockDataHandler.start().catch((error) => {
        console.error(`❌ 启动 Consumer 失败:`, error);
        // 如果是 OOM 错误，等待一段时间后重试
        if (error.message?.includes('OOM') || error.message?.includes('maxmemory')) {
            console.log(`⏳ Redis OOM detected, waiting 5 seconds before retry...`);
            setTimeout(() => {
                SolanaBlockDataHandler.start().catch((retryError) => {
                    console.error(`❌ 重试启动失败:`, retryError);
                    process.exit(1);
                });
            }, 5000);
        } else {
            process.exit(1);
        }
    });
}, startDelay);

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
    // 防止重复调用
    if (isShuttingDown) {
        console.log(`⚠️  关闭流程已在进行中，忽略重复信号 ${signal}`);
        return;
    }
    
    isShuttingDown = true;
    console.log(`[Signal] 收到 ${signal}，开始优雅关闭...`);
    
    try {
        await SolanaBlockDataHandler.stop();
        console.log(`[Signal] 优雅关闭完成`);
        
        // 在 PM2 环境中，使用 pm2 命令停止而不是直接 exit
        // 这样可以防止 PM2 自动重启
        if (isPM2) {
            console.log(`ℹ️  PM2 环境：使用 pm2 stop 停止进程以避免自动重启`);
            // 注意：这里仍然需要 exit，但 PM2 应该通过 pm2 stop 命令来停止
            // 如果直接 kill，PM2 会重启。应该通过 pm2 stop 命令来停止
        }
        
        process.exit(0);
    } catch (error) {
        console.error(`[Signal] 关闭过程中出错:`, error);
        process.exit(1);
    }
};

process.on("SIGINT", () => {
    gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
    gracefulShutdown("SIGTERM");
});