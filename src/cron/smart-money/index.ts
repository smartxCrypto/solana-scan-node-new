#!/usr/bin/env node

import { SmartMoneyAnalyzer, SmartMoneyCategory } from "@/smart-money/index";
import { SmartMoneyAddressService } from "@/service/smart_money/address";
import { args, exit } from '@/lib/node-utils';
import { SmartMoneyAnalysisConfig } from "../../constant/smart-money";

/**
 * 聪明钱定时任务配置
 */
interface SmartMoneyCronConfig {
    minCategoryScore: number;      // 最低置信度分数
    batchSize: number;             // 批处理大小
    maxRetries: number;            // 最大重试次数
    retryDelayMs: number;          // 重试延迟（毫秒）
    enableMaintenance: boolean;    // 是否启用数据库维护
    maintenanceIntervalDays: number; // 维护间隔天数
}

/**
 * 聪明钱定时任务执行结果
 */
interface CronExecutionResult {
    success: boolean;
    timestamp: string;
    duration: number;
    analyzed: number;
    discovered: number;
    stored: number;
    errors: string[];
    statistics: {
        byCategory: Record<string, number>;
        avgScore: number;
    };
}

/**
 * 聪明钱定时任务类
 */
export class SmartMoneyCronJob {
    private analyzer: SmartMoneyAnalyzer;
    private config: SmartMoneyCronConfig;
    private lastMaintenanceTime: number = 0;

    constructor(config?: Partial<SmartMoneyCronConfig>) {
        this.analyzer = new SmartMoneyAnalyzer();
        this.config = {
            minCategoryScore: 30,           // 最低30%置信度
            batchSize: 1000,               // 每批处理1000个地址
            maxRetries: 3,                 // 最多重试3次
            retryDelayMs: 5000,            // 重试间隔5秒
            enableMaintenance: true,       // 启用数据库维护
            maintenanceIntervalDays: 7,    // 每7天维护一次
            ...config
        };
    }

    /**
     * 主要的定时任务执行方法
     * 建议每日执行一次（如 00:30）
     */
    async execute(): Promise<CronExecutionResult> {
        const startTime = Date.now();
        const timestamp = new Date().toISOString();


        let result: CronExecutionResult = {
            success: false,
            timestamp,
            duration: 0,
            analyzed: 0,
            discovered: 0,
            stored: 0,
            errors: [],
            statistics: { byCategory: {}, avgScore: 0 }
        };

        try {
            // 1. 执行聪明钱分析
            const analysisResult = await this.executeWithRetry(
                () => this.performSmartMoneyAnalysis(),
                "smart money analysis"
            );

            result.analyzed = analysisResult.analyzed;
            result.discovered = analysisResult.discovered;
            result.stored = analysisResult.stored;
            result.statistics = analysisResult.statistics;

            // 2. 数据库维护（可选）
            // if (this.config.enableMaintenance && this.shouldPerformMaintenance()) {
            //     await this.executeWithRetry(
            //         () => this.performDatabaseMaintenance(),
            //         "smart money database maintenance"
            //     );
            // }

            result.success = true;

        } catch (error) {
            const errorMsg = `smart money cron job failed: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMsg);
            result.errors.push(errorMsg);
            result.success = false;
        } finally {
            result.duration = Date.now() - startTime;
        }

        return result;
    }

    /**
     * 执行聪明钱分析
     */
    private async performSmartMoneyAnalysis(): Promise<{
        analyzed: number;
        discovered: number;
        stored: number;
        statistics: { byCategory: Record<string, number>; avgScore: number };
        smartMoneyCount: number;
    }> {

        const analysisResults = await this.analyzer.dailySmartMoneyAnalysis();


        const smartMoneyResults = analysisResults.filter(result =>
            result.category !== SmartMoneyCategory.NORMAL &&
            result.categoryScore >= this.config.minCategoryScore
        );


        // 存储聪明钱地址
        let stored = 0;
        if (smartMoneyResults.length > 0) {
            const smartMoneyRecords = smartMoneyResults.map(result => ({
                address: result.metrics.walletAddress,
                category: result.category,
                category_score: result.categoryScore,
                mark_name: this.generateMarkName(result),
                last_analysis_time: new Date()
            }));

            stored = await SmartMoneyAddressService.batchInsertSmartMoneyAddresses(smartMoneyRecords);
        }


        // 生成统计信息
        const statistics = this.generateStatistics(smartMoneyResults);


        console.log("smart money results", statistics);


        return {
            analyzed: analysisResults.length,
            discovered: smartMoneyResults.length,
            stored,
            statistics,
            smartMoneyCount: smartMoneyResults.length
        };
    }



    /**
     * 带重试机制的执行方法
     */
    private async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.warn(`${operationName} failed (attempt ${attempt}/${this.config.maxRetries}): ${lastError.message}`);

                if (attempt < this.config.maxRetries) {
                    await this.delay(this.config.retryDelayMs);
                }
            }
        }

        throw new Error(`${operationName} failed after ${this.config.maxRetries} attempts: ${lastError?.message}`);
    }

    /**
     * 判断是否需要执行维护
     */
    private shouldPerformMaintenance(): boolean {
        const now = Date.now();
        const maintenanceInterval = this.config.maintenanceIntervalDays * 24 * 60 * 60 * 1000;
        return (now - this.lastMaintenanceTime) >= maintenanceInterval;
    }

    /**
     * 生成标记名称
     */
    private generateMarkName(result: any): string {
        const categoryNames: Record<string, string> = {
            [SmartMoneyCategory.HIGH_WIN_RATE]: "high_win_rate",
            [SmartMoneyCategory.HIGH_PROFIT_RATE]: "high_profit_rate",
            [SmartMoneyCategory.WHALE_PROFIT]: "whale_profit",
            [SmartMoneyCategory.NORMAL]: "normal"
        };

        const categoryName = categoryNames[result.category] || "unknown";
        const profitInfo = result.metrics.profit > 0 ?
            `+${result.metrics.profit.toFixed(2)}SOL` :
            `${result.metrics.profit.toFixed(2)}SOL`;

        return `${categoryName}_confidence_${result.categoryScore.toFixed(1)}%_profit_${profitInfo}`;
    }

    /**
     * 生成统计信息
     */
    private generateStatistics(results: any[]): { byCategory: Record<string, number>; avgScore: number } {
        const byCategory: Record<string, number> = {};
        let totalScore = 0;

        for (const result of results) {
            byCategory[result.category] = (byCategory[result.category] || 0) + 1;
            totalScore += result.categoryScore;
        }

        const avgScore = results.length > 0 ? totalScore / results.length : 0;
        return { byCategory, avgScore };
    }

    /**
     * 获取分类图标
     */
    private getCategoryIcon(category: string): string {
        const icons: Record<string, string> = {
            [SmartMoneyCategory.HIGH_WIN_RATE]: "🎯",
            [SmartMoneyCategory.HIGH_PROFIT_RATE]: "💰",
            [SmartMoneyCategory.WHALE_PROFIT]: "🐋",
            [SmartMoneyCategory.NORMAL]: "📊"
        };
        return icons[category] || "❓";
    }

    /**
     * 延迟方法
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 定时任务调度器
 */
export class SmartMoneyCronScheduler {
    private cronJob: SmartMoneyCronJob;
    private isRunning: boolean = false;
    private intervalId: number | null = null;

    constructor(config?: Partial<SmartMoneyCronConfig>) {
        this.cronJob = new SmartMoneyCronJob(config);
    }

    /**
     * 启动定时任务（每24小时执行一次）
     * @param hour 执行的小时（0-23），默认凌晨1点
     * @param minute 执行的分钟（0-59），默认0分
     */
    start(hour: number = 1, minute: number = 0): void {
        if (this.isRunning) {
            console.log("smart money cron job is already running");
            return;
        }

        console.log(`smart money cron job scheduler started`);
        console.log(`execute time: daily ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);

        this.isRunning = true;
        this.scheduleNextExecution(hour, minute);
    }

    /**
     * 停止定时任务
     */
    stop(): void {
        if (!this.isRunning) {
            console.log("smart money cron job is not running");
            return;
        }

        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }

        this.isRunning = false;
        console.log("smart money cron job scheduler stopped");
    }

    /**
     * 立即执行一次任务
     */
    async executeNow(): Promise<CronExecutionResult> {
        console.log("smart money cron job execute now");
        return await this.cronJob.execute();
    }

    /**
     * 检查定时任务状态
     */
    getStatus(): { isRunning: boolean; nextExecution?: string } {
        const status: { isRunning: boolean; nextExecution?: string } = {
            isRunning: this.isRunning
        };

        if (this.isRunning && this.intervalId) {
            // 这里可以计算下次执行时间，简化处理
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(1, 0, 0, 0); // 默认凌晨1点
            status.nextExecution = tomorrow.toISOString();
        }

        return status;
    }

    /**
     * 调度下次执行
     */
    private scheduleNextExecution(hour: number, minute: number): void {
        const now = new Date();
        const targetTime = new Date();
        targetTime.setHours(SmartMoneyAnalysisConfig.TWL, 0, 0, 0);

        // 如果目标时间已过，则设置为下一个小时
        if (targetTime <= now) {
            targetTime.setHours(SmartMoneyAnalysisConfig.TWL);
        }

        const delay = targetTime.getTime() - now.getTime();
        console.log(`next execute time: ${targetTime.toISOString()}`);

        this.intervalId = setTimeout(async () => {
            if (this.isRunning) {
                try {
                    await this.cronJob.execute();
                } catch (error) {
                    console.error("smart money cron job execute error:", error);
                }

                // 调度下次执行
                this.scheduleNextExecution(hour, minute);
            }
        }, delay) as any;
    }
}

/**
 * 全局实例
 */
export const smartMoneyCronJob = new SmartMoneyCronJob();
export const smartMoneyCronScheduler = new SmartMoneyCronScheduler();

/**
 * 主函数 - 用于直接运行
 */
async function main() {
    try {
        const args = process.argv.slice(2);
        if (args.includes("--run-once")) {
            // 立即执行一次
            console.log("smart money cron job execute now");
            const result = await smartMoneyCronJob.execute();
            console.log("smart money cron job execute result:", JSON.stringify(result, null, 2));
        } else if (args.includes("--start-scheduler")) {
            // 启动定时调度器
            console.log("smart money cron job scheduler start");
            smartMoneyCronScheduler.start(1, 30); // 每日凌晨1:30执行

            // 保持进程运行
            console.log("smart money cron job scheduler start success");
            await new Promise(() => { }); // 无限等待
        } else {
            console.log(`
smart money cron job
====================

usage:
  node src/cron/smart-money/index.js [options]

options:
  --run-once         run once
  --start-scheduler  start scheduler (daily)

示例:
  node src/cron/smart-money/index.js --run-once
  node src/cron/smart-money/index.js --start-scheduler
            `);
        }
    } catch (error) {
        console.error("smart money cron job execute failed:", error);
        exit(1);
    }
}

// 如果直接运行此文件
if (require.main === module) {
    main();
}
