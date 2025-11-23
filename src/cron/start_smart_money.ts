import * as cron from 'node-cron';
import { SmartMoneyCronJob } from './smart-money/index';

// 防止重复执行的标志
let isRunning = false;

/**
 * 聪明钱分析定时任务
 * 每小时执行一次
 */
async function startSmartMoneyScheduledTask() {
    console.log('🚀 启动聪明钱分析定时任务...');
    //立即执行一次
    const smartMoneyCronJob = new SmartMoneyCronJob();
    await smartMoneyCronJob.execute();

    // 每小时执行一次 (每小时的第0分钟)
    cron.schedule('0 * * * *', async () => {
        if (isRunning) {
            console.log('⏳ 聪明钱分析任务正在执行中，跳过本次执行');
            return;
        }

        isRunning = true;
        const startTime = Date.now();

        try {
            console.log(`⏰ 开始执行聪明钱分析任务: ${new Date().toISOString()}`);

            // 动态导入 smartMoneyCronJob
            await smartMoneyCronJob.execute();

            const duration = Date.now() - startTime;
            console.log(`✅ 聪明钱分析任务完成，耗时: ${duration}ms`);

        } catch (error) {
            console.error('❌ 聪明钱分析任务执行失败:', error);
        } finally {
            isRunning = false;
        }
    });

    console.log('⏰ 聪明钱分析定时任务已启动 (每小时执行一次)');
}


/**
 * 停止定时任务
 */
function stopScheduledTask(): void {
    console.log('🛑 停止聪明钱分析定时任务');
    // 简单的停止方法，通过设置标志位
    isRunning = false;
}

startSmartMoneyScheduledTask();

export {
    startSmartMoneyScheduledTask,
    stopScheduledTask
};
