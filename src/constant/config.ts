import { Protocol } from "../type/enum"
import dotenv from 'dotenv';

dotenv.config();

export const SOLANA_RPC_URL = "https://mainnet.helius-rpc.com/?api-key=3ed35a0b-35f6-4adb-8caa-5c72cd36b023";
// export const SOLANA_RPC_URL = "https://sol.chainup.net/9cfc99e6a9014cd497e26f129741a5dd"

export const SOLANA_RPC_URL_WS = ""

export const SOLANA_DEX_OFFICIAL_ADDRESS = {

    [Protocol.JUPITER]: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    [Protocol.ORCA]: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
    [Protocol.PUMP_FUN]: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    [Protocol.METEORA]: "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K"

}

export const SOLANA_DEX_ADDRESS_TO_NAME: Record<string, string> = {
    "11111111111111111111111111111111": "SOL",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
    "So11111111111111111111111111111111111111112": "WSOL",
    "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB": "USD1",
    "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH": "USDG",
    "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": "PYUSD",
    "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr": "EURC",
    "A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6": "USDY",
    "9zNQRsGLjNKwCUU5Gq5LR8beUCPzQMVMqKAi3SSZh54u": "FDUSD"
    
};


export const SOLANA_DEX_STABLE_TOKEN = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", //USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" //usdt
]


export const SOLANA_DEX_BASE_TOKEN = [
    "11111111111111111111111111111111", // sol
    "So11111111111111111111111111111111111111112",// "WSOL"
    ...SOLANA_DEX_STABLE_TOKEN
]

export const PUMPFUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"


export const SNAP_SHOT_CONFIG = {
    MIN_TRANSACTION_AMOUNT: 0.0001, // 0.0001 SOL
    SNAPSHOT_TIME_WINDOW: 30, // 30秒 (改为秒级)
    BLOCKS_PER_SNAPSHOT: 50, // 每10个区块进行一次快照
    SAFETY_BUFFER: 10 // 安全缓冲区，不处理最新的10个区块
};


export const SOL_SCAN_API_KEY = process.env.SOL_SCAN_API_KEY;