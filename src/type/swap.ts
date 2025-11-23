export enum ESwapTradeType {
    BUY = "BUY",
    SELL = "SELL",
}


export interface SwapTransactionToken {
    tx_hash: string;
    trade_type: ESwapTradeType;
    transaction_time: string;
    pool_address: string;
    block_height: number;
    wallet_address: string;
    token_amount: number;
    token_symbol: string;
    token_address: string;
    quote_symbol: string;
    quote_amount: number;
    quote_address: string;
    quote_price: number;
    usd_price: number;
    usd_amount: number;
}

export interface SwapTransactionWallet {
    tx_hash: string;
    trade_type: ESwapTradeType;
    transaction_time: string;
    pool_address: string;
    block_height: number;
    wallet_address: string;
    token_amount: number;
    token_symbol: string;
    token_address: string;
    quote_symbol: string;
    quote_amount: number;
    quote_address: string;
    quote_price: number;
    usd_price: number;
    usd_amount: number;
}



export interface TokenSwapFilterData {
    userAddress: string
    poolAddress: string
    txHash: string
    isBuy: boolean
    blockHeight: number
    tokenSymbol: string
    tokenAddress: string
    quoteSymbol: string
    quoteAddress: string
    quotePrice: number
    usdPrice: number
    usdAmount: number
    transactionTime: string
    tokenAmount: number
    quoteAmount: number
}



export interface UserSwapIndicators {
    [userAddress: string]: {
        tradeAmount: number;
        tradeDays: number;
        tradeTokenCount: number;
        tradeTokenList: string[];
        tradeTokenAmount: number[];
        tradeTokenPrice: number[];
        tradeTokenUsdPrice: number[];
        tradeTokenUsdAmount: number[];
        tradeTokenQuoteAmount: number[];
        tradeTokenQuotePrice: number[];
        tradeTokenQuoteUsdPrice: number[];
    }
}[]
