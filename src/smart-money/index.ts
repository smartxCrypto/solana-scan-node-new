import { SmartMoneyAddressService } from "@/service/smart_money/address";
import { ISmartMoneyAnalysisConfig } from "@/type/smart-money";
import { SmartMoneyAnalysisConfig } from "@/constant/smart-money";
import { getLatestTokenSnapshot } from "@/service/snapshot/token_ss";
import { TokenPriceService } from "@/service/TokenPriceService";
import { readTextFileSync } from '@/lib/node-utils';
import { SolanaBlockDataHandler } from "@/service/SolanaBlockDataHandler";
import { writeFileSync } from "fs-extra";

// 聪明钱指标接口
export interface SmartMoneyMetrics {
    walletAddress: string;
    analysisStartTime: number;
    analysisEndTime: number;

    // 基础财务指标
    native_token_balance: number;  // SOL计价的原生代币总价值
    wallet_balance: number;        // 账户总资产价值

    // 交易活跃度指标
    buy_token_count: number;       // 购买的代币种类数量
    active_days_present: number;   // 有交易活动的天数比率 (0-1)
    token_buy_counts: number;      // 平均每种代币的购买次数

    // 收益相关指标
    effective_win_token_pct: number; // 代币胜率 (0-1)
    profit: number;                  // 总收益 (SOL计价)

    // 时间维度指标
    weight_hold_time: number;        // 加权代币持有时长(秒)
    weight_average_time: number;     // 加权代币清仓时长(秒)
}

// 聪明钱分类枚举
export enum SmartMoneyCategory {
    HIGH_WIN_RATE = "high_win_rate",        // 高胜率组
    HIGH_PROFIT_RATE = "high_profit_rate",  // 高收益率组
    WHALE_PROFIT = "whale_profit",          // 鲸鱼盈利组
    NORMAL = "normal"                       // 普通用户
}

// 聪明钱分析结果
export interface SmartMoneyAnalysisResult {
    metrics: SmartMoneyMetrics;
    category: SmartMoneyCategory;
    categoryScore: number;  // 分类置信度分数
}

// 代币持有信息
interface TokenHoldingInfo {
    tokenAddress: string;
    buyAmount: number;
    sellAmount: number;
    buyValue: number;        // SOL计价买入价值
    sellValue: number;       // SOL计价卖出价值
    unrealizedValue: number; // 未实现价值
    realizedProfit: number;  // 已实现利润
    unrealizedProfit: number; // 未实现利润
    totalBuyCost: number;    // 买入成本
    firstBuyTime: number;    // 首次买入时间
    lastSellTime: number;    // 最后卖出时间
    buyCount: number;        // 买入次数
    isCleared: boolean;      // 是否已清仓
    holdTime: number;        // 持有时长
}

// 快照数据结构
interface ParsedSnapshot {
    wallet_address: string;
    snapshot_time: string;
    total_buy_sol_amount: number;
    total_buy_usd_amount: number;
    total_sell_sol_amount: number;
    total_sell_usd_amount: number;
    buy_count: number;
    sell_count: number;
    sol_price: number;
    win_count: number;
    lose_count: number;
    current_token_value: any[];
}

export class SmartMoneyAnalyzer {
    private readonly config: ISmartMoneyAnalysisConfig = SmartMoneyAnalysisConfig;

    /**
     * 每日聪明钱分析主入口
     * 基于新策略：获取过去1天活跃地址，通过快照差值计算指标
     */
    async dailySmartMoneyAnalysis(): Promise<SmartMoneyAnalysisResult[]> {

        try {
            // 1. 获取过去一个时间窗口的活跃钱包地址（已排除聪明钱）
            const startTime = new Date().getTime()/1000 - this.config.TWL * 60 * 60;

            const activeWallets = await SolanaBlockDataHandler.getActiveWalletAfterTransTime(
                startTime
            );

            console.log("一共找到了", activeWallets.length, "个活跃钱包");

            if (activeWallets.length === 0) {
                console.log("📭 没有找到需要分析的活跃钱包");
                return [];
            }

            const smartMoneyAddresses = await SmartMoneyAddressService.getAllSmartMoneyAddresses();

            const unAnalyzedWallets = activeWallets.filter(wallet => !smartMoneyAddresses.includes(wallet))

            console.log("获取到聪明钱筛选后的地址 个数为：", unAnalyzedWallets.length);

            // 2. 并发获取快照数据：3天前 vs 最新
            const [baselineSnapshots, latestSnapshots] = await Promise.all([
                SmartMoneyAddressService.getBaselineSnapshots(unAnalyzedWallets, this.config.DAYS_AGO),
                SmartMoneyAddressService.getLatestSnapshots(unAnalyzedWallets)
            ]);

            const uniqueTokenAddresses: string[] = [];
            latestSnapshots.forEach(snapshot => {
                snapshot.current_token_value.forEach((tokenValue: any) => {
                    if (tokenValue.tokenAddress && !uniqueTokenAddresses.includes(tokenValue.tokenAddress)) {
                        uniqueTokenAddresses.push(tokenValue.tokenAddress);
                    }
                });
            });


            console.log("uniqueTokenAddresses", uniqueTokenAddresses.length);

            const lastTokenPrices = await SolanaBlockDataHandler.getMultiTokenPrice(uniqueTokenAddresses);
            const solPrice = await TokenPriceService.getPrice('SOL', 'USDT');


            console.log("获取到", uniqueTokenAddresses.length, "个代币");

            // 3. 基于快照差值批量计算聪明钱指标
            const results = this.batchAnalyzeBySnapshotDelta(
                unAnalyzedWallets,
                baselineSnapshots,
                latestSnapshots,
                lastTokenPrices,
                solPrice
            );

            // 4. 输出分析结果
            // const smartMoneyCount = results.filter(r => r.category !== SmartMoneyCategory.NORMAL).length;

            return results;

        } catch (error) {
            return [];
        }
    }


    /**
     * 基于快照差值批量分析
     */
    public batchAnalyzeBySnapshotDelta(
        walletAddresses: string[],
        baselineSnapshots: Map<string, any>,
        latestSnapshots: Map<string, any>,
        lastTokenPrices: { [key: string]: number },
        solPrice: number
    ): SmartMoneyAnalysisResult[] {
        const results: SmartMoneyAnalysisResult[] = [];
        const currentTime = Math.floor(Date.now() / 1000);
        const analysisStartTime = currentTime - (this.config.BASELINE_DAYS_AGO * 24 * 60 * 60);

        for (const [index, walletAddress] of walletAddresses.entries()) {
            const baselineSnapshot = baselineSnapshots.get(walletAddress);
            const latestSnapshot = latestSnapshots.get(walletAddress);



            // 必须有最新快照才能分析
            if (!latestSnapshot) {
                // results.push(this.createEmptyResult(walletAddress, analysisStartTime, currentTime));
                continue;
            }


            // 解析快照数据
            const baseline = baselineSnapshot ? this.parseSnapshotData(baselineSnapshot) : null;
            const latest = this.parseSnapshotData(latestSnapshot);

            // 基于快照差值计算聪明钱指标
            const metrics = this.calculateMetricsBySnapshotDelta(
                walletAddress,
                baseline,
                latest,
                analysisStartTime,
                currentTime,
                lastTokenPrices,
                solPrice
            );




            // 聪明钱分类和评分
            const category = this.classifySmartMoney(metrics);
            const categoryScore = this.calculateCategoryScore(metrics, category);



            if (category !== SmartMoneyCategory.NORMAL) {
                results.push({
                    metrics,
                    category,
                    categoryScore
                });
            }
        }

        console.log("聪明钱分析结果 总数量为：", results.length);

        return results;
    }

    /**
     * 核心方法：基于快照差值计算聪明钱指标
     */
    private calculateMetricsBySnapshotDelta(
        walletAddress: string,
        baseline: ParsedSnapshot | null,
        latest: ParsedSnapshot,
        analysisStartTime: number,
        analysisEndTime: number,
        lastTokenPrices: { [key: string]: number },
        solPrice: number
    ): SmartMoneyMetrics {
        // 计算快照间的差值（这是关键）
        const startTime = new Date();
        const deltaBuyCount = latest.buy_count - (baseline?.buy_count || 0);
        const deltaSellCount = latest.sell_count - (baseline?.sell_count || 0);
        const deltaWinCount = latest.win_count - (baseline?.win_count || 0);
        const deltaLoseCount = latest.lose_count - (baseline?.lose_count || 0);
        const deltaBuyVolume = latest.total_buy_sol_amount - (baseline?.total_buy_sol_amount || 0);
        const deltaSellVolume = latest.total_sell_sol_amount - (baseline?.total_sell_sol_amount || 0);

        // 分析当前持仓代币，计算财务指标
        let native_token_balance = 0;
        let wallet_balance = 0;
        const uniqueTokens = new Set<string>();
        let totalTokensWithActivity = 0;
        let winningTokens = 0;

        let unrealizedProfit = 0

        // 遍历当前持仓代币
        for (const tokenValue of latest.current_token_value) {
            if (tokenValue.transactions && tokenValue.transactions > 0) {
                uniqueTokens.add(tokenValue.tokenAddress);
                totalTokensWithActivity++;

                const lastTokenPrice = lastTokenPrices[tokenValue.tokenAddress] || 0;
                const lastSolPrice = solPrice;
                const tokenCurrentValue = (tokenValue.tokenBalance || 0) * lastTokenPrice * lastSolPrice;
                native_token_balance += tokenCurrentValue;
                wallet_balance += tokenCurrentValue;

                unrealizedProfit += (tokenValue.tokenBalance || 0) * lastTokenPrice;

                // 判断是否为获胜代币（根据策略文档）
                const totalBuyCost = (tokenValue.totalBuyAmount || 0) * (tokenValue.tokenWeightBuyPrice || 0);


                if (totalBuyCost > 0) {

                    const realizedValue = (tokenValue.totalSellAmount || 0) * (tokenValue.tokenWeightSellPrice || 0);
                    const unrealizedValue = tokenCurrentValue;
                    const totalProfit = realizedValue + unrealizedValue - totalBuyCost;
                    const profitRate = totalProfit / totalBuyCost;

                    // 策略条件：profit_rate > 0.1 AND total_profit > 0.5 SOL
                    if (profitRate > 0.1 && totalProfit > 0.5) {
                        winningTokens++;
                    }
                }
            }
        }


        // 计算核心指标（基于差值和TWL=3）
        const profit = deltaSellVolume - deltaBuyVolume + unrealizedProfit; // 总收益
        const totalTransactions = deltaBuyCount + deltaSellCount;

        // 活跃天数比率：基于交易密度估算（TWL=3天）
        const active_days_present = Math.min(totalTransactions / (this.config.DAYS_AGO), 1);

        // 平均每种代币的购买次数
        const token_buy_counts = uniqueTokens.size > 0 ? deltaBuyCount / uniqueTokens.size : 0;

        // 代币胜率
        const effective_win_token_pct = totalTokensWithActivity > 0 ? (winningTokens / totalTokensWithActivity) : 0;

        // 时间维度指标（基于统计估算）
        const avgHoldTimeSeconds = 1.5 * 24 * 60 * 60 * this.config.TWL; // 假设平均持有1.5天 todo
        const weight_hold_time = avgHoldTimeSeconds;
        const weight_average_time = (deltaWinCount + deltaLoseCount) > 0 ? avgHoldTimeSeconds : 0;

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        return {
            walletAddress,
            analysisStartTime,
            analysisEndTime,
            native_token_balance,
            wallet_balance,
            buy_token_count: uniqueTokens.size,
            active_days_present,
            token_buy_counts,
            effective_win_token_pct,
            profit,
            weight_hold_time,
            weight_average_time
        };
    }

    /**
     * 解析快照数据（从数据库行格式转换）
     */
    private parseSnapshotData(snapshotRow: any): ParsedSnapshot {
        if (!snapshotRow) {
            return {
                wallet_address: '',
                snapshot_time: '',
                total_buy_sol_amount: 0,
                total_buy_usd_amount: 0,
                total_sell_sol_amount: 0,
                total_sell_usd_amount: 0,
                buy_count: 0,
                sell_count: 0,
                sol_price: 0,
                win_count: 0,
                lose_count: 0,
                current_token_value: []
            };
        }

        // 根据wallet_trading_ss表结构解析（需要根据实际表结构调整索引）
        return {
            wallet_address: snapshotRow.wallet_address || '',
            snapshot_time: snapshotRow.snapshot_time || '',
            total_buy_sol_amount: Number(snapshotRow.total_buy_sol_amount) || 0,
            total_buy_usd_amount: Number(snapshotRow.total_buy_usd_amount) || 0,
            total_sell_sol_amount: Number(snapshotRow.total_sell_sol_amount) || 0,
            total_sell_usd_amount: Number(snapshotRow.total_sell_usd_amount) || 0,
            buy_count: Number(snapshotRow.buy_count) || 0,
            sell_count: Number(snapshotRow.sell_count) || 0,
            sol_price: Number(snapshotRow.sol_price) || 0,
            win_count: Number(snapshotRow.win_count) || 0,
            lose_count: Number(snapshotRow.lose_count) || 0,
            current_token_value: typeof snapshotRow.current_token_value === 'string' ? JSON.parse(snapshotRow.current_token_value) : snapshotRow.current_token_value || []
        };
    }

    /**
     * 聪明钱分类（使用TWL=3）
     */
    protected classifySmartMoney(metrics: SmartMoneyMetrics): SmartMoneyCategory {
        const TWL = this.config.TWL; // 3
        const DAYS_AGO = this.config.DAYS_AGO;


        // 高胜率组条件
        const isHighWinRate = (
            (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) &&
            (metrics.profit > 3 * DAYS_AGO) &&  // 0.075 SOL
            (metrics.effective_win_token_pct) > 0.5
            &&
            (metrics.token_buy_counts > 0.3 * DAYS_AGO) &&  // 0.9 todo
            (metrics.active_days_present > 0.3 * DAYS_AGO)  // 0.9 (实际是0.3，因为比率) todo
        );

        // 高收益率组条件
        const isHighProfitRate = (
            (metrics.profit > 1 * DAYS_AGO) &&  // 2.1 SOL
            (metrics.effective_win_token_pct > 0.7) &&
            (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1)
            &&
            (metrics.token_buy_counts > 0.1 * DAYS_AGO) &&  // 0.3 todo
            (metrics.active_days_present > 0.3 * DAYS_AGO)  // 0.9 (实际是0.3) todo
        );

        // 鲸鱼盈利组条件
        // const isWhaleProfit = (
        //     (metrics.native_token_balance > 1000 || metrics.wallet_balance > 2000) &&
        //     metrics.effective_win_token_pct > 0.3
        //     &&
        //     metrics.token_buy_counts > 0.1 * DAYS_AGO &&  // 0.3 todo
        //     metrics.active_days_present > 0.3 * DAYS_AGO  // 0.9 (实际是0.3) todo
        // );

        // 优先级排序：鲸鱼 > 高收益率 > 高胜率 > 普通
        // if (isWhaleProfit) return SmartMoneyCategory.WHALE_PROFIT;
        if (isHighProfitRate) {
            return SmartMoneyCategory.HIGH_PROFIT_RATE;
        }
        if (isHighWinRate) {
            return SmartMoneyCategory.HIGH_WIN_RATE;
        }

        return SmartMoneyCategory.NORMAL;
    }

    /**
     * 计算分类置信度分数（使用TWL=3）
     */
    protected calculateCategoryScore(metrics: SmartMoneyMetrics, category: SmartMoneyCategory): number {
        const TWL = this.config.TWL; // 3
        let score = 0;


        switch (category) {
            case SmartMoneyCategory.HIGH_WIN_RATE:
                score += (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) ? 20 : 0;
                score += Math.min(metrics.profit / (0.025 * TWL), 2) * 20;
                score += Math.min(metrics.effective_win_token_pct / 0.6, 1) * 20;
                score += Math.min(metrics.token_buy_counts / (0.3 * TWL), 1) * 20;
                score += Math.min(metrics.active_days_present / (0.3 * TWL), 1) * 20;
                break;

            case SmartMoneyCategory.HIGH_PROFIT_RATE:
                score += Math.min(metrics.profit / (0.7 * TWL), 2) * 30;
                score += Math.min(metrics.effective_win_token_pct / 0.5, 1) * 25;
                score += (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) ? 20 : 0;
                score += Math.min(metrics.token_buy_counts / (0.1 * TWL), 1) * 15;
                score += Math.min(metrics.active_days_present / (0.3 * TWL), 1) * 10;
                break;

            case SmartMoneyCategory.WHALE_PROFIT:
                score += (metrics.native_token_balance > 1000 || metrics.wallet_balance > 2000) ? 40 : 0;
                score += Math.min(metrics.effective_win_token_pct / 0.3, 1) * 30;
                score += Math.min(metrics.token_buy_counts / (0.1 * TWL), 1) * 15;
                score += Math.min(metrics.active_days_present / (0.3 * TWL), 1) * 15;
                break;

            default:
                score = 0;
        }

        return Math.min(score, 100);
    }

    /**
     * 创建空结果
     */
    private createEmptyResult(
        walletAddress: string,
        analysisStartTime: number,
        analysisEndTime: number
    ): SmartMoneyAnalysisResult {
        return {
            metrics: {
                walletAddress,
                analysisStartTime,
                analysisEndTime,
                native_token_balance: 0,
                wallet_balance: 0,
                buy_token_count: 0,
                active_days_present: 0,
                token_buy_counts: 0,
                effective_win_token_pct: 0,
                profit: 0,
                weight_hold_time: 0,
                weight_average_time: 0
            },
            category: SmartMoneyCategory.NORMAL,
            categoryScore: 0
        };
    }


}
