import { SnapShotForWalletTrading } from "../../type/transaction";
import { SwapTransactionToken, TokenSwapFilterData } from "../../type/swap";
import { TOKENS } from "../../constant/token";
import { SolanaBlockDataHandler } from "../../service/SolanaBlockDataHandler";
import { SnapshotInfo } from "../../type/snapshot";
import { 
    getLatestWalletTradingSnapshot, 
    getLatestWalletTradingSnapshotBeforeTime,
    batchGetLatestWalletTradingSnapshotBeforeTime
} from "../../service/snapshot/wallet_trading_ss";

interface SnapshotWalletTradingFilterData {
    [walletAddress: string]: SnapShotForWalletTrading
}

// 预运算的钱包数据结构
interface PreComputedWalletData {
    walletAddress: string;
    transactions: TokenSwapFilterData[];
    earliestTime: string;
    latestTime: string;
}

/**
 * 预运算：按钱包地址聚合交易数据
 */
function preComputeWalletTransactions(txs: TokenSwapFilterData[]): PreComputedWalletData[] {
    const walletMap = new Map<string, {
        transactions: TokenSwapFilterData[];
        earliestTime: string;
        latestTime: string;
    }>();

    for (const tx of txs) {
        const walletAddress = tx.userAddress;
        
        if (!walletMap.has(walletAddress)) {
            walletMap.set(walletAddress, {
                transactions: [],
                earliestTime: tx.transactionTime,
                latestTime: tx.transactionTime
            });
        }

        const walletData = walletMap.get(walletAddress)!;
        walletData.transactions.push(tx);
        
        // 更新时间范围
        if (tx.transactionTime < walletData.earliestTime) {
            walletData.earliestTime = tx.transactionTime;
        }
        if (tx.transactionTime > walletData.latestTime) {
            walletData.latestTime = tx.transactionTime;
        }
    }

    const result = Array.from(walletMap.entries()).map(([walletAddress, data]) => ({
        walletAddress,
        transactions: data.transactions,
        earliestTime: data.earliestTime,
        latestTime: data.latestTime
    }));

    return result;
}

/**
 * 将钱包数据分组以便批量处理
 */
function groupWalletsForBatchProcessing(wallets: PreComputedWalletData[], batchSize: number = 500): PreComputedWalletData[][] {
    const groups: PreComputedWalletData[][] = [];
    
    for (let i = 0; i < wallets.length; i += batchSize) {
        groups.push(wallets.slice(i, i + batchSize));
    }
    
    return groups;
}

/**
 * 处理单个钱包组的快照数据
 */
async function processWalletGroup(
    walletGroup: PreComputedWalletData[], 
    groupIndex: number
): Promise<SnapShotForWalletTrading[]> {
    // 1. 批量查询历史数据
    const walletAddresses = walletGroup.map(w => w.walletAddress);
    
    // 正确地将时间字符串转换为 Unix 时间戳（秒）
    // earliestTime 可能是 ISO 字符串或数字字符串
    const earliestTimestamp = Math.min(...walletGroup.map(w => {
        const time = w.earliestTime;
        // 如果是 ISO 格式的字符串（包含 '-' 或 'T'）
        if (typeof time === 'string' && (time.includes('-') || time.includes('T'))) {
            return Math.floor(new Date(time).getTime() / 1000);
        }
        // 如果是数字字符串，直接解析
        const parsed = parseInt(time);
        // 如果解析出的数字看起来像毫秒时间戳（大于 1e12）
        if (parsed > 1e12) {
            return Math.floor(parsed / 1000);
        }
        // 否则假定是秒级时间戳
        return parsed;
    }));
    
    const historicalDataMap = await batchGetLatestWalletTradingSnapshotBeforeTime(
        walletAddresses, 
        earliestTimestamp
    );

    // 2. 处理每个钱包的交易数据
    const results: SnapShotForWalletTrading[] = [];

    for (const walletData of walletGroup) {
        const walletResult = await processWalletTransactions(
            walletData, 
            historicalDataMap.get(walletData.walletAddress)
        );
        results.push(walletResult);
    }

    return results;
}

/**
 * 处理单个钱包的交易数据
 */
async function processWalletTransactions(
    walletData: PreComputedWalletData,
    historicalSnapshot?: SnapShotForWalletTrading
): Promise<SnapShotForWalletTrading> {
    // 初始化钱包快照数据
    const walletSnapshot: SnapShotForWalletTrading = historicalSnapshot ? {
        ...historicalSnapshot,
        walletAddress: walletData.walletAddress,
        snapshotTime: walletData.latestTime,
        perTLTradingValue: [], // 重置为当前批次的交易
        currentTokenValue: historicalSnapshot.currentTokenValue ? 
            [...historicalSnapshot.currentTokenValue.map(item => ({ ...item }))] : []
    } : {
        walletAddress: walletData.walletAddress,
        snapshotTime: walletData.latestTime,
        perTLTradingValue: [],
        totalBuySolAmount: 0,
        totalBuyUsdAmount: 0,
        totalSellSolAmount: 0,
        totalSellUsdAmount: 0,
        buy_count: 0,
        sell_count: 0,
        solPrice: 0,
        winCount: 0,
        loseCount: 0,
        currentTokenValue: [],
    };

    // 处理所有交易
    for (const tx of walletData.transactions) {
        // 过滤无效的交易对
        if (tx.quoteAddress !== TOKENS.SOL && tx.quoteAddress !== TOKENS.USDC && tx.quoteAddress !== TOKENS.USDT) {
            continue;
        }

        // 更新快照时间和SOL价格
        walletSnapshot.snapshotTime = tx.transactionTime;
        
        // 安全计算 solPrice，避免 NaN
        if (typeof tx.usdPrice === 'number' && typeof tx.quotePrice === 'number' && 
            !isNaN(tx.usdPrice) && !isNaN(tx.quotePrice) && 
            tx.quotePrice > 0 && tx.usdPrice > 0) {
            walletSnapshot.solPrice = tx.usdPrice / tx.quotePrice;
        } else {
            // 记录问题数据并使用安全的默认值
            console.warn(`SOL price calculation error for wallet ${walletSnapshot.walletAddress}: invalid usdPrice (${tx.usdPrice}) or quotePrice (${tx.quotePrice})`);
            
            // 如果当前的 solPrice 是有效的，则保持不变，否则使用默认值
            if (isNaN(walletSnapshot.solPrice) || walletSnapshot.solPrice <= 0) {
                walletSnapshot.solPrice = 100; // 使用合理的默认SOL价格
            }
        }

        // 添加交易记录
        walletSnapshot.perTLTradingValue.push({
            tokenAddress: tx.tokenAddress,
            tradeAmount: tx.tokenAmount,
            tokenPrice: tx.quotePrice,
            tokenUsdPrice: tx.usdPrice,
            tradeSolAmount: tx.quoteAmount,
            tradeUsdAmount: tx.usdAmount,
            isBuy: tx.isBuy,
        });

        // 更新买卖统计
        if (tx.isBuy) {
            walletSnapshot.totalBuySolAmount += tx.quoteAmount;
            walletSnapshot.totalBuyUsdAmount += tx.usdAmount;
            walletSnapshot.buy_count += 1;
        } else {
            walletSnapshot.totalSellSolAmount += tx.quoteAmount;
            walletSnapshot.totalSellUsdAmount += tx.usdAmount;
            walletSnapshot.sell_count += 1;
        }

        // 更新代币持仓信息
        updateTokenValue(walletSnapshot, tx);
    }

    // 处理清仓逻辑
    processTokenClearances(walletSnapshot);

    return walletSnapshot;
}

/**
 * 更新代币持仓信息
 */
function updateTokenValue(walletSnapshot: SnapShotForWalletTrading, tx: TokenSwapFilterData) {
    let tokenValueIndex = walletSnapshot.currentTokenValue.findIndex(
        item => item.tokenAddress === tx.tokenAddress
    );

    if (tokenValueIndex === -1) {
        // 创建新的代币记录
        walletSnapshot.currentTokenValue.push({
            tokenAddress: tx.tokenAddress,
            tokenBalance: 0,
            tokenSolPrice: tx.quotePrice,
            tokenUsdPrice: tx.usdPrice,
            tokenWeightBuyPrice: 0,
            tokenWeightBuyUsdPrice: 0,
            tokenWeightSellPrice: 0,
            tokenWeightSellUsdPrice: 0,
            totalBuyAmount: 0,
            totalSellAmount: 0,
            transactions: 0,
            isCleared: false,
            clearanceHistory: [],
        });
        tokenValueIndex = walletSnapshot.currentTokenValue.length - 1;
    }

    const tokenValue = walletSnapshot.currentTokenValue[tokenValueIndex];

    // 重新加仓逻辑
    if (tokenValue.isCleared && tx.isBuy) {
        tokenValue.tokenBalance = 0;
        tokenValue.tokenWeightBuyPrice = 0;
        tokenValue.tokenWeightBuyUsdPrice = 0;
        tokenValue.tokenWeightSellPrice = 0;
        tokenValue.tokenWeightSellUsdPrice = 0;
        tokenValue.totalBuyAmount = 0;
        tokenValue.totalSellAmount = 0;
        tokenValue.transactions = 0;
        tokenValue.isCleared = false;
    }

    // 更新价格和交易次数
    tokenValue.tokenSolPrice = tx.quotePrice;
    tokenValue.tokenUsdPrice = tx.usdPrice;
    tokenValue.transactions += 1;

    if (tx.isBuy) {
        // 买入逻辑
        const prevTotalBuyAmount = tokenValue.totalBuyAmount;
        const prevTotalBuyCost = prevTotalBuyAmount * tokenValue.tokenWeightBuyPrice;
        const prevTotalBuyUsdCost = prevTotalBuyAmount * tokenValue.tokenWeightBuyUsdPrice;

        const newTotalBuyAmount = prevTotalBuyAmount + tx.tokenAmount;
        const newTotalBuyCost = prevTotalBuyCost + tx.tokenAmount * tx.quotePrice;
        const newTotalBuyUsdCost = prevTotalBuyUsdCost + tx.tokenAmount * tx.usdPrice;

        tokenValue.totalBuyAmount = newTotalBuyAmount;
        tokenValue.tokenBalance += tx.tokenAmount;

        if (newTotalBuyAmount > 0) {
            tokenValue.tokenWeightBuyPrice = newTotalBuyCost / newTotalBuyAmount;
            tokenValue.tokenWeightBuyUsdPrice = newTotalBuyUsdCost / newTotalBuyAmount;
        }
    } else {
        // 卖出逻辑
        const prevTotalSellAmount = tokenValue.totalSellAmount;
        const prevTotalSellRevenue = prevTotalSellAmount * tokenValue.tokenWeightSellPrice;
        const prevTotalSellUsdRevenue = prevTotalSellAmount * tokenValue.tokenWeightSellUsdPrice;

        const newTotalSellAmount = prevTotalSellAmount + tx.tokenAmount;
        const newTotalSellRevenue = prevTotalSellRevenue + tx.tokenAmount * tx.quotePrice;
        const newTotalSellUsdRevenue = prevTotalSellUsdRevenue + tx.tokenAmount * tx.usdPrice;

        tokenValue.totalSellAmount = newTotalSellAmount;
        tokenValue.tokenBalance -= tx.tokenAmount;

        if (newTotalSellAmount > 0) {
            tokenValue.tokenWeightSellPrice = newTotalSellRevenue / newTotalSellAmount;
            tokenValue.tokenWeightSellUsdPrice = newTotalSellUsdRevenue / newTotalSellAmount;
        }
    }

    // 立即检查清仓
    checkAndProcessClearance(walletSnapshot, tokenValue);
}

/**
 * 检查并处理单个代币的清仓
 */
function checkAndProcessClearance(walletSnapshot: SnapShotForWalletTrading, tokenValue: any) {
    if (tokenValue.totalBuyAmount > 0) {
        const sellRatio = tokenValue.totalSellAmount / tokenValue.totalBuyAmount;

        if (sellRatio > 0.99) {
            // 清仓逻辑
            const avgBuyPrice = tokenValue.tokenWeightBuyUsdPrice;
            const avgSellPrice = tokenValue.tokenWeightSellUsdPrice;

            if (avgSellPrice > avgBuyPrice) {
                walletSnapshot.winCount += 1;
            } else if (avgSellPrice < avgBuyPrice) {
                walletSnapshot.loseCount += 1;
            }

            // 保存清仓历史
            const pnlUsd = (tokenValue.tokenWeightSellUsdPrice - tokenValue.tokenWeightBuyUsdPrice) * tokenValue.totalSellAmount;
            const pnlSol = (tokenValue.tokenWeightSellPrice - tokenValue.tokenWeightBuyPrice) * tokenValue.totalSellAmount;
            
            if (!tokenValue.clearanceHistory) {
                tokenValue.clearanceHistory = [];
            }

            tokenValue.clearanceHistory.push({
                clearanceTime: walletSnapshot.snapshotTime,
                totalBuyAmount: tokenValue.totalBuyAmount,
                totalSellAmount: tokenValue.totalSellAmount,
                avgBuyPrice: tokenValue.tokenWeightBuyPrice,
                avgBuyUsdPrice: tokenValue.tokenWeightBuyUsdPrice,
                avgSellPrice: tokenValue.tokenWeightSellPrice,
                avgSellUsdPrice: tokenValue.tokenWeightSellUsdPrice,
                transactions: tokenValue.transactions,
                isProfit: avgSellPrice > avgBuyPrice,
                pnlSol: pnlSol,
                pnlUsd: pnlUsd
            });

            tokenValue.isCleared = true;
            tokenValue.tokenBalance = 0;
        } else if (tokenValue.totalSellAmount >= tokenValue.totalBuyAmount) {
            tokenValue.tokenBalance = 0;
        }
    }
}

/**
 * 处理空投代币清仓
 */
function processTokenClearances(walletSnapshot: SnapShotForWalletTrading) {
    walletSnapshot.currentTokenValue.forEach(tokenValue => {
        if (tokenValue.totalBuyAmount === 0 && tokenValue.totalSellAmount > 0 && !tokenValue.isCleared) {
            if (!tokenValue.clearanceHistory) {
                tokenValue.clearanceHistory = [];
            }

            tokenValue.clearanceHistory.push({
                clearanceTime: walletSnapshot.snapshotTime,
                totalBuyAmount: 0,
                totalSellAmount: tokenValue.totalSellAmount,
                avgBuyPrice: 0,
                avgBuyUsdPrice: 0,
                avgSellPrice: tokenValue.tokenWeightSellPrice,
                avgSellUsdPrice: tokenValue.tokenWeightSellUsdPrice,
                transactions: tokenValue.transactions,
                isProfit: true,
                pnlSol: tokenValue.tokenWeightSellPrice * tokenValue.totalSellAmount,
                pnlUsd: tokenValue.tokenWeightSellUsdPrice * tokenValue.totalSellAmount
            });

            tokenValue.isCleared = true;
            tokenValue.tokenBalance = 0;
            walletSnapshot.winCount += 1;
        }
    });
}

/**
 * 优化版本的钱包交易快照处理函数
 * 使用预运算 + 批量查询 + 并行处理
 */
export const snapshotWalletTradingByTxDataOptimized = async (txs: TokenSwapFilterData[]): Promise<SnapShotForWalletTrading[]> => {
    console.log(`Processing ${txs.length} transactions with optimized algorithm`);

    // 1. 预运算：按钱包聚合
    const preComputedWallets = preComputeWalletTransactions(txs);

    // 2. 分组批量处理
    const batchSize = 500;
    const walletGroups = groupWalletsForBatchProcessing(preComputedWallets, batchSize);

    // 3. 并行处理所有组
    const groupPromises = walletGroups.map((group, index) => 
        processWalletGroup(group, index)
    );

    const groupResults = await Promise.all(groupPromises);

    // 4. 合并结果
    const allResults = groupResults.flat();

    console.log(`Optimized processing completed: ${allResults.length} wallet snapshots generated`);

    return allResults;
};

// 创建兼容的钱包交易服务对象
const walletTradingService = {
    async initWalletTrading(walletAddress: string, transactionTime: string): Promise<SnapShotForWalletTrading | null> {
        // 转换时间戳格式
        const timestamp = parseInt(transactionTime);
        return await getLatestWalletTradingSnapshotBeforeTime(walletAddress, timestamp);
    }
};

export const snapshotWalletTradingByTxData = async (txs: TokenSwapFilterData[]): Promise<SnapShotForWalletTrading[]> => {
    console.log(`Processing ${txs.length} transactions`);
    
    const result: SnapshotWalletTradingFilterData = {};

    for (const tx of txs) {
        const walletAddress = tx.userAddress;

        // 如果这个钱包地址还没有处理过，则初始化
        if (!result[walletAddress]) {
            const walletTradingArray = await walletTradingService.initWalletTrading(walletAddress, tx.transactionTime);
            
            // 取数组的第一个元素作为钱包交易数据，并进行深拷贝以避免引用共享
            const baseData = walletTradingArray;
            result[walletAddress] = baseData ? {
                ...baseData,
                walletAddress: walletAddress,
                snapshotTime: !tx.transactionTime || tx.transactionTime.trim() === '' || isNaN(new Date(tx.transactionTime).getTime())
                    ? new Date().toISOString()
                    : tx.transactionTime,
                perTLTradingValue: [], // 重置为空数组，只包含当前批次的交易
                currentTokenValue: baseData.currentTokenValue ? [...baseData.currentTokenValue.map((item: any) => ({ ...item }))] : []
            } : {
                walletAddress: walletAddress,
                snapshotTime: !tx.transactionTime || tx.transactionTime.trim() === '' || isNaN(new Date(tx.transactionTime).getTime())
                    ? new Date().toISOString()
                    : tx.transactionTime,
                perTLTradingValue: [],
                totalBuySolAmount: 0,
                totalBuyUsdAmount: 0,
                totalSellSolAmount: 0,
                totalSellUsdAmount: 0,
                buy_count: 0,
                sell_count: 0,
                solPrice: 0,
                winCount: 0,
                loseCount: 0,
                currentTokenValue: [],
            };
        }

        const walletTrading = result[walletAddress];

        // 更新快照时间为当前交易时间
        // 验证交易时间的有效性
        if (!tx.transactionTime || tx.transactionTime.trim() === '' || isNaN(new Date(tx.transactionTime).getTime())) {
            walletTrading.snapshotTime = new Date().toISOString();
        } else {
            walletTrading.snapshotTime = tx.transactionTime;
        }
        
        // 安全计算 solPrice，避免 NaN
        if (typeof tx.usdPrice === 'number' && typeof tx.quotePrice === 'number' && 
            !isNaN(tx.usdPrice) && !isNaN(tx.quotePrice) && 
            tx.quotePrice > 0 && tx.usdPrice > 0) {
            walletTrading.solPrice = tx.usdPrice / tx.quotePrice;
        } else {
            // 记录问题数据并使用安全的默认值
            console.warn(`SOL price calculation error for wallet ${walletTrading.walletAddress}: invalid usdPrice (${tx.usdPrice}) or quotePrice (${tx.quotePrice})`);
            
            // 如果当前的 solPrice 是有效的，则保持不变，否则使用默认值
            if (isNaN(walletTrading.solPrice) || walletTrading.solPrice <= 0) {
                walletTrading.solPrice = 100; // 使用合理的默认SOL价格
            }
        }

        if (tx.quoteAddress !== TOKENS.SOL && tx.quoteAddress !== TOKENS.USDC && tx.quoteAddress !== TOKENS.USDT) {
            continue;
        }

        // 添加单笔交易到 perTLTradingValue（只包含当前批次的交易）
        walletTrading.perTLTradingValue.push({
            tokenAddress: tx.tokenAddress,
            tradeAmount: tx.tokenAmount,
            tokenPrice: tx.quotePrice,
            tokenUsdPrice: tx.usdPrice,
            tradeSolAmount: tx.quoteAmount,
            tradeUsdAmount: tx.usdAmount,
            isBuy: tx.isBuy,
        });

        // 更新买卖总金额和计数（累加历史数据）
        if (tx.isBuy) {
            walletTrading.totalBuySolAmount += tx.quoteAmount;
            walletTrading.totalBuyUsdAmount += tx.usdAmount;
            walletTrading.buy_count += 1;
        } else {
            walletTrading.totalSellSolAmount += tx.quoteAmount;
            walletTrading.totalSellUsdAmount += tx.usdAmount;
            walletTrading.sell_count += 1;
        }

        // 更新或创建 currentTokenValue 中的代币信息
        let tokenValueIndex = walletTrading.currentTokenValue.findIndex(
            item => item.tokenAddress === tx.tokenAddress
        );

        if (tokenValueIndex === -1) {
            // 创建新的代币记录
            walletTrading.currentTokenValue.push({
                tokenAddress: tx.tokenAddress,
                tokenBalance: 0,
                tokenSolPrice: tx.quotePrice,
                tokenUsdPrice: tx.usdPrice,
                tokenWeightBuyPrice: 0,
                tokenWeightBuyUsdPrice: 0,
                tokenWeightSellPrice: 0,
                tokenWeightSellUsdPrice: 0,
                totalBuyAmount: 0,
                totalSellAmount: 0,
                transactions: 0,
                isCleared: false,
                clearanceHistory: [],
            });
            tokenValueIndex = walletTrading.currentTokenValue.length - 1;
        }

        const tokenValue = walletTrading.currentTokenValue[tokenValueIndex];

        // 如果是已清仓的代币且当前是买入操作，重置当前持仓数据
        if (tokenValue.isCleared && tx.isBuy) {
            // 重置当前持仓数据，但保留清仓历史
            tokenValue.tokenBalance = 0;
            tokenValue.tokenWeightBuyPrice = 0;
            tokenValue.tokenWeightBuyUsdPrice = 0;
            tokenValue.tokenWeightSellPrice = 0;
            tokenValue.tokenWeightSellUsdPrice = 0;
            tokenValue.totalBuyAmount = 0;
            tokenValue.totalSellAmount = 0;
            tokenValue.transactions = 0;
            tokenValue.isCleared = false;
        }

        // 更新代币当前价格
        tokenValue.tokenSolPrice = tx.quotePrice;
        tokenValue.tokenUsdPrice = tx.usdPrice;
        tokenValue.transactions += 1;

        if (tx.isBuy) {
            // 买入操作 - 计算加权平均买入价格
            const prevTotalBuyAmount = tokenValue.totalBuyAmount;
            const prevTotalBuyCost = prevTotalBuyAmount * tokenValue.tokenWeightBuyPrice;
            const prevTotalBuyUsdCost = prevTotalBuyAmount * tokenValue.tokenWeightBuyUsdPrice;

            const newTotalBuyAmount = prevTotalBuyAmount + tx.tokenAmount;
            const newTotalBuyCost = prevTotalBuyCost + tx.tokenAmount * tx.quotePrice;
            const newTotalBuyUsdCost = prevTotalBuyUsdCost + tx.tokenAmount * tx.usdPrice;

            tokenValue.totalBuyAmount = newTotalBuyAmount;
            tokenValue.tokenBalance += tx.tokenAmount;

            // 计算加权平均买入价格
            if (newTotalBuyAmount > 0) {
                tokenValue.tokenWeightBuyPrice = newTotalBuyCost / newTotalBuyAmount;
                tokenValue.tokenWeightBuyUsdPrice = newTotalBuyUsdCost / newTotalBuyAmount;
            }
        } else {
            // 卖出操作 - 计算加权平均卖出价格
            const prevTotalSellAmount = tokenValue.totalSellAmount;
            const prevTotalSellRevenue = prevTotalSellAmount * tokenValue.tokenWeightSellPrice;
            const prevTotalSellUsdRevenue = prevTotalSellAmount * tokenValue.tokenWeightSellUsdPrice;

            const newTotalSellAmount = prevTotalSellAmount + tx.tokenAmount;
            const newTotalSellRevenue = prevTotalSellRevenue + tx.tokenAmount * tx.quotePrice;
            const newTotalSellUsdRevenue = prevTotalSellUsdRevenue + tx.tokenAmount * tx.usdPrice;

            tokenValue.totalSellAmount = newTotalSellAmount;
            tokenValue.tokenBalance -= tx.tokenAmount;

            // 计算加权平均卖出价格
            if (newTotalSellAmount > 0) {
                tokenValue.tokenWeightSellPrice = newTotalSellRevenue / newTotalSellAmount;
                tokenValue.tokenWeightSellUsdPrice = newTotalSellUsdRevenue / newTotalSellAmount;
            }
        }

        // 每次交易后立即检查是否需要清仓
            if (tokenValue.totalBuyAmount > 0) {
                const sellRatio = tokenValue.totalSellAmount / tokenValue.totalBuyAmount;

            // 卖出比例超过99%，视为清仓
                if (sellRatio > 0.99) {
                    // 用户已清仓，计算盈亏
                    const avgBuyPrice = tokenValue.tokenWeightBuyUsdPrice;
                    const avgSellPrice = tokenValue.tokenWeightSellUsdPrice;

                    if (avgSellPrice > avgBuyPrice) {
                        walletTrading.winCount += 1;
                    } else if (avgSellPrice < avgBuyPrice) {
                        walletTrading.loseCount += 1;
                    }

                // 保存清仓历史记录
                const pnlUsd = (tokenValue.tokenWeightSellUsdPrice - tokenValue.tokenWeightBuyUsdPrice) * tokenValue.totalSellAmount;
                const pnlSol = (tokenValue.tokenWeightSellPrice - tokenValue.tokenWeightBuyPrice) * tokenValue.totalSellAmount;
                
                if (!tokenValue.clearanceHistory) {
                    tokenValue.clearanceHistory = [];
                }

                // 添加清仓记录到历史中
                tokenValue.clearanceHistory.push({
                    clearanceTime: walletTrading.snapshotTime,
                    totalBuyAmount: tokenValue.totalBuyAmount,
                    totalSellAmount: tokenValue.totalSellAmount,
                    avgBuyPrice: tokenValue.tokenWeightBuyPrice,
                    avgBuyUsdPrice: tokenValue.tokenWeightBuyUsdPrice,
                    avgSellPrice: tokenValue.tokenWeightSellPrice,
                    avgSellUsdPrice: tokenValue.tokenWeightSellUsdPrice,
                    transactions: tokenValue.transactions,
                    isProfit: avgSellPrice > avgBuyPrice,
                    pnlSol: pnlSol,
                    pnlUsd: pnlUsd
                });

                // 标记为已清仓并将持仓余额设为0
                tokenValue.isCleared = true;
                tokenValue.tokenBalance = 0;
            }
            // 卖出数量超过买入数量，tokenBalance设为0
            else if (tokenValue.totalSellAmount >= tokenValue.totalBuyAmount) {
                tokenValue.tokenBalance = 0;
            }
        }
    }

    const resultSnapShot: SnapShotForWalletTrading[] = [];

    for (const walletAddress in result) {
        const walletTrading = result[walletAddress];

        // 只检查空投代币的情况（没有买入记录但有卖出记录的代币）
        walletTrading.currentTokenValue.forEach(tokenValue => {
            // 只处理空投代币直接卖出的情况（没有买入记录）
            if (tokenValue.totalBuyAmount === 0 && tokenValue.totalSellAmount > 0 && !tokenValue.isCleared) {
                if (!tokenValue.clearanceHistory) {
                    tokenValue.clearanceHistory = [];
                }

                tokenValue.clearanceHistory.push({
                    clearanceTime: walletTrading.snapshotTime,
                    totalBuyAmount: 0,
                    totalSellAmount: tokenValue.totalSellAmount,
                    avgBuyPrice: 0,
                    avgBuyUsdPrice: 0,
                    avgSellPrice: tokenValue.tokenWeightSellPrice,
                    avgSellUsdPrice: tokenValue.tokenWeightSellUsdPrice,
                    transactions: tokenValue.transactions,
                    isProfit: true, // 空投直接卖出算作盈利
                    pnlSol: tokenValue.tokenWeightSellPrice * tokenValue.totalSellAmount,
                    pnlUsd: tokenValue.tokenWeightSellUsdPrice * tokenValue.totalSellAmount
                });

                // 标记为已清仓
                tokenValue.isCleared = true;
                tokenValue.tokenBalance = 0;
                
                // 增加盈利计数
                walletTrading.winCount += 1;
            }
        });

        resultSnapShot.push(walletTrading);
    }

    console.log(`Processing completed: ${resultSnapShot.length} wallet snapshots generated`);

    return resultSnapShot;
}

export const snapShotUserTokenData = async (startTimestamp: number, endTimestamp: number): Promise<SnapShotForWalletTrading[]> => {
    let pageNum = 1;
    const pageSize = 10000;
    let totalTokenTxData: SwapTransactionToken[] = [];
    while (true) {
        const tokenTxData = await SolanaBlockDataHandler.getXDaysDataByTimestamp(startTimestamp, endTimestamp, pageNum, pageSize);
        if (tokenTxData.length === 0) {
            break;
        }
        totalTokenTxData = [...totalTokenTxData, ...tokenTxData];
        pageNum++;
    }
    const tokenTxDataFilter = SolanaBlockDataHandler.filterTokenData(totalTokenTxData);
    return snapshotWalletTradingByTxData(tokenTxDataFilter);
}

function dbToWalletTradingSnapShot(userPerSnapshot: SnapshotInfo | null): SnapShotForWalletTrading | PromiseLike<SnapShotForWalletTrading | null> | null {
    throw new Error("Function not implemented.");
}

/**
 * 获取钱包指定代币的清仓历史
 */
export const getTokenClearanceHistory = (
    walletSnapshot: SnapShotForWalletTrading, 
    tokenAddress: string
): Array<{
    clearanceTime: string;
    totalBuyAmount: number;
    totalSellAmount: number;
    avgBuyPrice: number;
    avgBuyUsdPrice: number;
    avgSellPrice: number;
    avgSellUsdPrice: number;
    transactions: number;
    isProfit: boolean;
    pnlSol: number;
    pnlUsd: number;
}> => {
    const tokenValue = walletSnapshot.currentTokenValue.find(
        item => item.tokenAddress === tokenAddress
    );
    return tokenValue?.clearanceHistory || [];
};

/**
 * 计算钱包所有代币的历史清仓总盈亏
 */
export const calculateTotalClearancePnL = (walletSnapshot: SnapShotForWalletTrading): {
    totalClearances: number;
    totalPnlSol: number;
    totalPnlUsd: number;
    profitableClearances: number;
    unprofitableClearances: number;
} => {
    let totalClearances = 0;
    let totalPnlSol = 0;
    let totalPnlUsd = 0;
    let profitableClearances = 0;
    let unprofitableClearances = 0;

    walletSnapshot.currentTokenValue.forEach(tokenValue => {
        if (tokenValue.clearanceHistory && tokenValue.clearanceHistory.length > 0) {
            tokenValue.clearanceHistory.forEach(clearance => {
                totalClearances++;
                totalPnlSol += clearance.pnlSol;
                totalPnlUsd += clearance.pnlUsd;
                
                if (clearance.isProfit) {
                    profitableClearances++;
                } else {
                    unprofitableClearances++;
                }
            });
        }
    });

    return {
        totalClearances,
        totalPnlSol,
        totalPnlUsd,
        profitableClearances,
        unprofitableClearances
    };
};

/**
 * 获取钱包所有已清仓代币的列表
 */
export const getClearedTokensList = (walletSnapshot: SnapShotForWalletTrading): Array<{
    tokenAddress: string;
    clearanceCount: number;
    totalHistoricalPnlUsd: number;
    isCurrentlyCleared: boolean;
}> => {
    const clearedTokens: Array<{
        tokenAddress: string;
        clearanceCount: number;
        totalHistoricalPnlUsd: number;
        isCurrentlyCleared: boolean;
    }> = [];

    walletSnapshot.currentTokenValue.forEach(tokenValue => {
        if (tokenValue.clearanceHistory && tokenValue.clearanceHistory.length > 0) {
            const totalPnl = tokenValue.clearanceHistory.reduce(
                (sum, clearance) => sum + clearance.pnlUsd, 
                0
            );

            clearedTokens.push({
                tokenAddress: tokenValue.tokenAddress,
                clearanceCount: tokenValue.clearanceHistory.length,
                totalHistoricalPnlUsd: totalPnl,
                isCurrentlyCleared: tokenValue.isCleared || false
            });
        }
    });

    return clearedTokens;
};

export { walletTradingService };
