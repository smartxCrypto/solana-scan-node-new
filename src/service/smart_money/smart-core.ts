import { getLpInfoByToken, LpInfo } from "@/service/lpInfo";
import { getTokenInfoFromDB, getTokenInfoUseCache } from "@/service/TokenInfoService";
import { TokenInfo } from "@/type/token";
import { SolanaBlockDataHandler, SwapTransaction } from "../SolanaBlockDataHandler";

export class SmartCore {

    private smartAddress: string;

    constructor(smartAddress: string) {
        this.smartAddress = smartAddress;
    }

    async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
        let tokenInfo = await getTokenInfoUseCache(tokenAddress);
        if (!tokenInfo) {
            tokenInfo = await getTokenInfoFromDB(tokenAddress);
            if (!tokenInfo) {
                return null;
            }
            return tokenInfo;
        }
        return tokenInfo;
    }


    async getTokenLpInfo(tokenAddress: string): Promise<LpInfo | null> {
        const lpInfo = await getLpInfoByToken(tokenAddress);
        if (lpInfo.length === 0) {
            return null;
        }
        return lpInfo[0];
    }

    async getTokenLastTransaction(tokenAddress: string): Promise<SwapTransaction | null> {

        const swapTransaction = await SolanaBlockDataHandler.getTokenLastTransaction(tokenAddress);
        if (!swapTransaction) {
            return null;
        }
        return swapTransaction;
    }


    async getTokenSmartScore(tokenAddress: string): Promise<number> {
        // 每有一个聪明钱交易则加一分 上限十分
        let tradeSmNumScore = 0

        // 获取最近五分钟内买入的聪明钱的数量 每有一个加3分 最多15分
        let multiTradeScore = 0

        // 平均买入均额度是否大于平均买入的百分之五十 当前阶段给满
        const buyAvgAmountScore = 10

        // 代币上线时间在一小时内加10分 后续每多一小时降一分 下限为0
        let tokenLauchScore = 0

        // 代币流动性 流动性满足代币当前市值的每百一 加0.5分 上限10%
        let tokenLpScore = 0

        // 相对市值 
        let relativeMarketCapScore = 0

        // 持仓集中度
        let concentrationScore = 10

        // 异常交易模式
        let abnormalTradeScore = 5
        // 市场周期热度 当前默认给满
        const marketCircleScore = 15


        let tokenLastPrice = 0

        let totalScore = 0

        const currentTime = Math.floor(Date.now() / 1000);

        const tokenPurchaseStats = await SolanaBlockDataHandler.getWalletTokenPurchaseDetails(tokenAddress, 5);

        const smartPurchaseWallets = tokenPurchaseStats.filter(item => item.walletAddress === this.smartAddress)

        tokenLastPrice = tokenPurchaseStats[tokenPurchaseStats.length - 1].avgPrice

        if (smartPurchaseWallets.length > 0) {
            tradeSmNumScore = Math.min(smartPurchaseWallets.length, 10)

            const multiTradeWallets = smartPurchaseWallets.filter(item => currentTime - item.latestBuyTime < 300)
            if (multiTradeWallets.length > 0) {
                multiTradeScore = Math.min(multiTradeWallets.length * 3, 15)
            }
        }

        const tokenInfo = await this.getTokenInfo(tokenAddress);
        if (tokenInfo) {
            if (tokenInfo.token_create_ts) {
                const launchTime = tokenInfo.token_create_ts
                const launchTimeDiff = currentTime - launchTime
                if (launchTimeDiff < 3600) {
                    tokenLauchScore = 10
                } else {
                    tokenLauchScore = Math.max(10 - (launchTimeDiff / 3600), 0)
                }
            }
        }


        const tokenLpInfo = await this.getTokenLpInfo(tokenAddress);
        if (tokenLpInfo) {
            const lpAmount = tokenLpInfo.liquidity_usd
            const tokenMarketCap = tokenLastPrice * (tokenInfo?.total_supply || 0)
            if (lpAmount > 0 && tokenMarketCap > 0) {
                tokenLpScore = Math.min(Number(lpAmount) / tokenMarketCap * 100, 10)
            }
        }


        totalScore = marketCircleScore + tradeSmNumScore + multiTradeScore + buyAvgAmountScore + tokenLauchScore + tokenLpScore + relativeMarketCapScore + concentrationScore + abnormalTradeScore

        return totalScore

    }
}