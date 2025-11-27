import { SolanaBlockDataHandler } from "../../service/SolanaBlockDataHandler";
import { SwapTransactionToken, TokenSwapFilterData } from "../../type/swap";
import { TokenNormSnapShot } from "../../type/transaction";


interface SnapshotTokenFilterData {
    [tokenPoolKey: string]: TokenNormSnapShot
}

// 预运算的token数据结构
interface PreComputedTokenData {
    tokenAddress: string;
    poolAddress: string;
    transactions: TokenSwapFilterData[];
    earliestTime: string;
    latestTime: string;
}

const initTokenNormSnapShot = (): TokenNormSnapShot => {
    return {
        blockHeight: 0,
        blockTime: "0",
        tokenAddress: "",
        buyAmount: 0,
        sellAmount: 0,
        buyCount: 0,
        sellCount: 0,
        highPrice: 0,
        lowPrice: 0,
        startPrice: 0,
        endPrice: 0,
        avgPrice: 0,
        poolAddress: "",
        snapShotBlockTime: 0,
    }
}

/**
 * 预运算：按Token地址和Pool地址聚合交易数据
 */
function preComputeTokenTransactions(txs: TokenSwapFilterData[]): PreComputedTokenData[] {
    const tokenMap = new Map<string, {
        transactions: TokenSwapFilterData[];
        earliestTime: string;
        latestTime: string;
    }>();

    for (const tx of txs) {
        const key = `${tx.tokenAddress}_${tx.poolAddress}`;
        
        if (!tokenMap.has(key)) {
            tokenMap.set(key, {
                transactions: [],
                earliestTime: tx.transactionTime,
                latestTime: tx.transactionTime
            });
        }

        const tokenData = tokenMap.get(key)!;
        tokenData.transactions.push(tx);
        
        // 更新时间范围
        if (tx.transactionTime < tokenData.earliestTime) {
            tokenData.earliestTime = tx.transactionTime;
        }
        if (tx.transactionTime > tokenData.latestTime) {
            tokenData.latestTime = tx.transactionTime;
        }
    }

    const result = Array.from(tokenMap.entries()).map(([key, data]) => {
        const [tokenAddress, poolAddress] = key.split('_');
        return {
            tokenAddress,
            poolAddress,
            transactions: data.transactions,
            earliestTime: data.earliestTime,
            latestTime: data.latestTime
        };
    });

    return result;
}

/**
 * 将Token数据分组以便批量处理
 */
function groupTokensForBatchProcessing(tokens: PreComputedTokenData[], batchSize: number = 1000): PreComputedTokenData[][] {
    const groups: PreComputedTokenData[][] = [];
    
    for (let i = 0; i < tokens.length; i += batchSize) {
        groups.push(tokens.slice(i, i + batchSize));
    }
    
    return groups;
}

/**
 * 处理单个Token组的快照数据
 */
function processTokenGroup(
    tokenGroup: PreComputedTokenData[], 
    groupIndex: number
): TokenNormSnapShot[] {
    const results: TokenNormSnapShot[] = [];

    for (const tokenData of tokenGroup) {
        const tokenResult = processTokenTransactions(tokenData);
        results.push(tokenResult);
    }

    return results;
}

/**
 * 处理单个token-pool组合的交易数据
 */
function processTokenTransactions(tokenData: PreComputedTokenData): TokenNormSnapShot {
    const tokenSnapshot = initTokenNormSnapShot();
    
    // 设置基本信息
    tokenSnapshot.tokenAddress = tokenData.tokenAddress;
    tokenSnapshot.poolAddress = tokenData.poolAddress;
    
    let totalPriceSum = 0;
    let priceCount = 0;
    
    // 按时间排序确保正确的开始和结束价格
    const sortedTransactions = tokenData.transactions.sort((a, b) => 
        parseInt(a.transactionTime) - parseInt(b.transactionTime)
    );

    for (let i = 0; i < sortedTransactions.length; i++) {
        const tx = sortedTransactions[i];
        
        // 设置时间和区块信息（首次）
        if (tokenSnapshot.blockTime === "0") {
            tokenSnapshot.blockTime = tx.transactionTime;
            tokenSnapshot.blockHeight = tx.blockHeight || 0;
            tokenSnapshot.startPrice = tx.quotePrice;
        }

        // 更新买卖统计
        if (tx.isBuy) {
            tokenSnapshot.buyAmount += tx.tokenAmount;
            tokenSnapshot.buyCount += 1;
        } else {
            tokenSnapshot.sellAmount += tx.tokenAmount;
            tokenSnapshot.sellCount += 1;
        }

        // 更新价格统计
        if (tx.quotePrice > tokenSnapshot.highPrice) {
            tokenSnapshot.highPrice = tx.quotePrice;
        }

        if (tx.quotePrice < tokenSnapshot.lowPrice || tokenSnapshot.lowPrice === 0) {
            tokenSnapshot.lowPrice = tx.quotePrice;
        }

        // 累计价格用于计算平均值
        totalPriceSum += tx.quotePrice;
        priceCount++;

        // 设置结束价格（最后一笔交易）
        tokenSnapshot.endPrice = tx.quotePrice;
    }

    // 计算平均价格
    if (priceCount > 0) {
        tokenSnapshot.avgPrice = totalPriceSum / priceCount;
    }

    // 计算快照时间跨度
    if (sortedTransactions.length > 0) {
        const firstTx = sortedTransactions[0];
        const lastTx = sortedTransactions[sortedTransactions.length - 1];
        const firstTime = Number(firstTx.transactionTime);
        const lastTime = Number(lastTx.transactionTime);
        tokenSnapshot.snapShotBlockTime = isNaN(firstTime) || isNaN(lastTime) ? 0 : lastTime - firstTime;
    }

    return tokenSnapshot;
}

export const snapshotTokenValueByTxData = (txs: TokenSwapFilterData[]): TokenNormSnapShot[] => {
    const result: SnapshotTokenFilterData = {};

    for (const tx of txs) {
        const tokenPoolKey = `${tx.tokenAddress}-${tx.poolAddress}`;
        const tokenNormSnapShot = result[tokenPoolKey] || initTokenNormSnapShot();

        if (tokenNormSnapShot.blockTime === "") {
            tokenNormSnapShot.blockTime = tx.transactionTime;
        }

        if (tokenNormSnapShot.blockHeight === 0) {
            tokenNormSnapShot.blockHeight = tx.blockHeight || 0;
        }

        if (tx.isBuy) {
            tokenNormSnapShot.buyAmount += tx.tokenAmount;
            tokenNormSnapShot.buyCount += 1;
        } else {
            tokenNormSnapShot.sellAmount += tx.tokenAmount;
            tokenNormSnapShot.sellCount += 1;
        }

        if (tx.quotePrice > tokenNormSnapShot.highPrice) {
            tokenNormSnapShot.highPrice = tx.quotePrice;
        }

        if (tx.quotePrice < tokenNormSnapShot.lowPrice || tokenNormSnapShot.lowPrice === 0) {
            tokenNormSnapShot.lowPrice = tx.quotePrice;
        }

        if (tokenNormSnapShot.startPrice === 0) {
            tokenNormSnapShot.startPrice = tx.quotePrice;
        }

        if (tokenNormSnapShot.avgPrice === 0) {
            tokenNormSnapShot.avgPrice = tx.quotePrice;
        } else {
            tokenNormSnapShot.avgPrice = (tokenNormSnapShot.avgPrice + tx.quotePrice) / 2;
        }

        tokenNormSnapShot.endPrice = tx.quotePrice;

        const txTime = Number(tx.transactionTime);
        const blockTime = Number(tokenNormSnapShot.blockTime);
        tokenNormSnapShot.snapShotBlockTime = isNaN(txTime) || isNaN(blockTime) ? 0 : txTime - blockTime;

        tokenNormSnapShot.poolAddress = tx.poolAddress;
        tokenNormSnapShot.tokenAddress = tx.tokenAddress;

        result[tokenPoolKey] = tokenNormSnapShot;
    }

    const resultSnapShot: TokenNormSnapShot[] = [];

    for (const tokenPoolKey in result) {
        resultSnapShot.push(result[tokenPoolKey]);
    }

    return resultSnapShot;

}



export const snapShotTokenData = async (startTimestamp: number, endTimestamp: number): Promise<TokenNormSnapShot[]> => {
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
    return snapshotTokenValueByTxData(tokenTxDataFilter);
}