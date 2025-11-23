import { ResLpInfoStruct, ResSwapStruct, ResTokenMetadataStruct, ResTokenPriceStruct, ResUserTradingSummaryStruct } from "./filter_struct";
import { MemeEvent } from "./meme";
import { PoolEvent } from './pool';
import { TokenAmount, TradeInfo, TransferData } from './trade';
import { Buffer } from 'node:buffer';

export interface ClassifiedInstruction {
  instruction: any;
  programId: string;
  outerIndex: number;
  innerIndex?: number;
}

export interface BalanceChange {
  pre: TokenAmount;
  post: TokenAmount;
  change: TokenAmount;
}


export type TransactionStatus = 'unknown' | 'success' | 'failed';
export interface ParseResult {
  /** Parsing success status - true if parsing completed successfully */
  state: boolean;
  /** Transaction gas fee paid in SOL */
  fee: TokenAmount;
  /** Aggregated trade information combining multiple related trades */
  aggregateTrade?: TradeInfo;
  /** Array of individual trade transactions found in the transaction */
  trades: TradeInfo[];
  /** Array of liquidity operations (add/remove/create pool) */
  liquidities: PoolEvent[];
  /** Array of token transfer operations not related to trades */
  transfers: TransferData[];
  /** SOL balance change for the transaction signer */
  solBalanceChange?: BalanceChange;
  /** Token balance changes mapped by token mint address */
  tokenBalanceChange?: Map<string, BalanceChange>;
  /** Meme platform events (create/buy/sell/migrate/complete) */
  memeEvents: MemeEvent[];
  /** Solana slot number where the transaction was included */
  slot: number;
  /** Unix timestamp when the transaction was processed */
  timestamp: number;
  /** Unique transaction signature identifier */
  signature: string;
  /** Array of public keys that signed this transaction */
  signer: string[];
  /** Compute units consumed by the transaction execution */
  computeUnits: number;
  /** Final execution status of the transaction */
  txStatus: TransactionStatus;
  /** Optional error or status message */
  msg?: string;
}

export type EventParser<T> = {
  discriminator: Buffer | Uint8Array;
  decode: (data: Buffer) => T;
};

export type EventsParser<T> = {
  discriminators: (Buffer | Uint8Array)[];
  slice: number;
  decode: (data: Buffer, options: any) => T;
};
