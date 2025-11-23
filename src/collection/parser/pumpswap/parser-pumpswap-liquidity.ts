import { DEX_PROGRAMS } from '@/constant';
import { TransactionAdapter } from '@/collection/parser/transaction-adapter';
import {
  ClassifiedInstruction,
  convertToUiAmount,
  PoolEvent,
  PumpswapCreatePoolEvent,
  PumpswapDepositEvent,
  PumpswapEvent,
  PumpswapWithdrawEvent,
  TransferData,
} from '@/type';
import { BaseLiquidityParser } from '../base-liquidity-parser';
import { PumpswapEventParser } from './event';

export class PumpswapLiquidityParser extends BaseLiquidityParser {
  private eventParser: PumpswapEventParser;

  constructor(
    adapter: TransactionAdapter,
    transferActions: Record<string, TransferData[]>,
    classifiedInstructions: ClassifiedInstruction[]
  ) {
    super(adapter, transferActions, classifiedInstructions);
    this.eventParser = new PumpswapEventParser(adapter);
  }

  public processLiquidity(): PoolEvent[] {
    const events = this.eventParser
      .parseInstructions(this.classifiedInstructions)
      .filter((event) => ['CREATE', 'ADD', 'REMOVE'].includes(event.type));

    return events.length > 0 ? this.parseLiquidityEvents(events) : [];
  }

  private parseLiquidityEvents(events: PumpswapEvent[]): PoolEvent[] {
    if (!events.length) return [];
    return events
      .map((event) => {
        switch (event.type) {
          case 'CREATE':
            return this.parseCreateEvent(event);
          case 'ADD':
            return this.parseDepositEvent(event);
          case 'REMOVE':
            return this.parseWithdrawEvent(event);
          default:
            return null;
        }
      })
      .filter((it) => it != null);
  }

  private parseCreateEvent(data: PumpswapEvent): PoolEvent {
    const event = data.data as PumpswapCreatePoolEvent;

    return {
      ...this.adapter.getPoolEventBase('CREATE', DEX_PROGRAMS.PUMP_SWAP.id),
      idx: data.idx,
      poolId: event.pool,
      poolLpMint: event.lpMint,
      token0Mint: event.baseMint,
      token1Mint: event.quoteMint,
      token0Amount: convertToUiAmount(event.baseAmountIn, event.baseMintDecimals),
      token0AmountRaw: event.baseAmountIn.toString(),
      token1Amount: convertToUiAmount(event.quoteAmountIn, event.quoteMintDecimals),
      token1AmountRaw: event.quoteAmountIn.toString(),
      token0Decimals: event.baseMintDecimals,
      token1Decimals: event.quoteMintDecimals,
    };
  }

  private parseDepositEvent(data: PumpswapEvent): PoolEvent {
    const event = data.data as PumpswapDepositEvent;
    const token0Mint = this.adapter.splTokenMap.get(event.userBaseTokenAccount)!.mint;
    const token0Decimals = this.adapter.getTokenDecimals(token0Mint);
    const token1Mint = this.adapter.splTokenMap.get(event.userQuoteTokenAccount)!.mint;
    const token1Decimals = this.adapter.getTokenDecimals(token1Mint);
    return {
      ...this.adapter.getPoolEventBase('ADD', DEX_PROGRAMS.PUMP_SWAP.id),
      idx: data.idx,
      poolId: event.pool,
      poolLpMint: this.adapter.splTokenMap.get(event.userPoolTokenAccount)!.mint,
      token0Mint: token0Mint,
      token1Mint: token1Mint,
      token0Amount: convertToUiAmount(event.baseAmountIn, token0Decimals),
      token0AmountRaw: event.baseAmountIn.toString(),
      token1Amount: convertToUiAmount(event.quoteAmountIn, token1Decimals),
      token1AmountRaw: event.quoteAmountIn.toString(),
      token0Decimals: token0Decimals,
      token1Decimals: token1Decimals,
    };
  }

  private parseWithdrawEvent(data: PumpswapEvent): PoolEvent {
    const event = data.data as PumpswapWithdrawEvent;
    const token0Mint = this.adapter.splTokenMap.get(event.userBaseTokenAccount)!.mint;
    const token0Decimals = this.adapter.getTokenDecimals(token0Mint);
    const token1Mint = this.adapter.splTokenMap.get(event.userQuoteTokenAccount)!.mint;
    const token1Decimals = this.adapter.getTokenDecimals(token1Mint);
    return {
      ...this.adapter.getPoolEventBase('REMOVE', DEX_PROGRAMS.PUMP_SWAP.id),
      idx: data.idx,
      poolId: event.pool,
      poolLpMint: this.adapter.splTokenMap.get(event.userPoolTokenAccount)!.mint,
      token0Mint: token0Mint,
      token1Mint: token1Mint,
      token0Amount: convertToUiAmount(event.baseAmountOut, token0Decimals),
      token0AmountRaw: event.baseAmountOut.toString(),
      token1Amount: convertToUiAmount(event.quoteAmountOut, token1Decimals),
      token1AmountRaw: event.quoteAmountOut.toString(),
      token0Decimals: token0Decimals,
      token1Decimals: token1Decimals,
    };
  }
}
