import { ConfirmedTransactionMeta, TransactionVersion, VersionedMessage } from "@solana/web3.js";

export interface TransactionInfo {
    slot: number;
    blockTime: number | null;
    blockHash: string;
    parentSlot: number;
    transactionCount: number | null;
    transactions: {
        index: number;
        signature: string;
        transaction: {
            /** The transaction */
            transaction: {
                /** The transaction message */
                message: VersionedMessage;
                /** The transaction signatures */
                signatures: string[];
            };
            /** Metadata produced from the transaction */
            meta: ConfirmedTransactionMeta | null;
            /** The transaction version */
            version?: TransactionVersion;
        };
        meta: ConfirmedTransactionMeta | null;
    }[];
}


export interface SolanaOnChainDataStruct {
    meta: {
        computeUnitsConsumed: number;
        err: null;
        fee: number;
        innerInstructions: {
            index: number;
            instructions: {
                accounts: number[];
                data: string;
            }[];
        }[];
        loadedAddresses: {
            readonly: string[];
            writable: string[];
        };
        logMessages: string[];
        postBalances: number[];
        postTokenBalances: {
            accountIndex: number;
            mint: string;
            owner: string;
            programId: string;
            uiTokenAmount: {
                amount: string;
                decimals: number;
                uiAmount: number | null;
                uiAmountString: string;
            };
        }[];
        preBalances: number[];
        preTokenBalances: {
            accountIndex: number;
            mint: string;
            owner: string;
            programId: string;
        }[];
        rewards: {
            lamports: number;
            postBalance: number;
            preBalance: number;
        }[];
        status: {
            Ok: null;
        };
    }
    transaction: {
        message: {
            header: {
                numReadonlySignedAccounts: number;
                numReadonlyUnsignedAccounts: number;
                numRequiredSignatures: number;
            };
            accountKeys: string[];
            recentBlockhash: string;
            instructions: {
                accounts: number[];
                data: string;
                programIdIndex: number;
            }[];
            indexToProgramIds: {
                [key: string]: string;
            };
        };
        signatures: string[];
        version: "legacy" | "v0";
    }
}


export interface TokenNormSnapShot {
    blockHeight: number // 区块高度
    blockTime: string // 区块时间
    tokenAddress: string // 代币地址
    buyAmount: number // 购买数量
    sellAmount: number //售出数量
    buyCount: number // 购买笔数
    sellCount: number // 售出笔数
    highPrice: number // 最高价格
    lowPrice: number // 最低价格
    startPrice: number //开盘价格
    endPrice: number //收盘价格
    avgPrice: number //平均价格
    poolAddress: string //池子地址
    snapShotBlockTime: number //此次快照包含的区块时间跨度
}


export interface SnapShotForWalletTrading {
    walletAddress: string
    snapshotTime: string
    perTLTradingValue: {
        tokenAddress: string
        tradeAmount: number
        tokenPrice: number
        tokenUsdPrice: number
        tradeSolAmount: number
        tradeUsdAmount: number
        isBuy: boolean
    }[]
    totalBuySolAmount: number
    totalBuyUsdAmount: number
    totalSellSolAmount: number
    totalSellUsdAmount: number
    buy_count: number
    sell_count: number
    solPrice: number
    winCount: number
    loseCount: number
    currentTokenValue: {
        tokenAddress: string
        tokenBalance: number
        tokenWeightBuyPrice: number
        tokenWeightBuyUsdPrice: number
        tokenWeightSellPrice: number
        tokenWeightSellUsdPrice: number
        tokenSolPrice: number
        tokenUsdPrice: number
        totalBuyAmount: number
        totalSellAmount: number
        transactions: number
        isCleared?: boolean
        clearanceHistory?: {
            clearanceTime: string
            totalBuyAmount: number
            totalSellAmount: number
            avgBuyPrice: number
            avgBuyUsdPrice: number
            avgSellPrice: number
            avgSellUsdPrice: number
            transactions: number
            isProfit: boolean
            pnlSol: number
            pnlUsd: number
        }[]
    }[]
}