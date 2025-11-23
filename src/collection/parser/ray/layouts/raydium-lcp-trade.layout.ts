import base58 from 'bs58';
import { PoolStatus, RaydiumLCPTradeEvent, TradeDirection } from '@/type';

export class RaydiumLCPTradeLayout {
  poolState: Uint8Array;
  totalBaseSell: bigint;
  virtualBase: bigint;
  virtualQuote: bigint;
  realBaseBefore: bigint;
  realQuoteBefore: bigint;
  realBaseAfter: bigint;
  realQuoteAfter: bigint;
  amountIn: bigint;
  amountOut: bigint;
  protocolFee: bigint;
  platformFee: bigint;
  shareFee: bigint;
  tradeDirection: TradeDirection;
  poolStatus: PoolStatus;

  constructor(fields: {
    poolState: Uint8Array;
    totalBaseSell: bigint;
    virtualBase: bigint;
    virtualQuote: bigint;
    realBaseBefore: bigint;
    realQuoteBefore: bigint;
    realBaseAfter: bigint;
    realQuoteAfter: bigint;
    amountIn: bigint;
    amountOut: bigint;
    protocolFee: bigint;
    platformFee: bigint;
    shareFee: bigint;
    tradeDirection: TradeDirection;
    poolStatus: PoolStatus;
  }) {
    this.poolState = fields.poolState;
    this.totalBaseSell = fields.totalBaseSell;
    this.virtualBase = fields.virtualBase;
    this.virtualQuote = fields.virtualQuote;
    this.realBaseBefore = fields.realBaseBefore;
    this.realQuoteBefore = fields.realQuoteBefore;
    this.realBaseAfter = fields.realBaseAfter;
    this.realQuoteAfter = fields.realQuoteAfter;
    this.amountIn = fields.amountIn;
    this.amountOut = fields.amountOut;
    this.protocolFee = fields.protocolFee;
    this.platformFee = fields.platformFee;
    this.shareFee = fields.shareFee;
    this.tradeDirection = fields.tradeDirection;
    this.poolStatus = fields.poolStatus;
  }

  static schema = new Map([
    [
      RaydiumLCPTradeLayout,
      {
        kind: 'struct',
        fields: [
          ['poolState', [32]],
          ['totalBaseSell', 'u64'],
          ['virtualBase', 'u64'],
          ['virtualQuote', 'u64'],
          ['realBaseBefore', 'u64'],
          ['realQuoteBefore', 'u64'],
          ['realBaseAfter', 'u64'],
          ['realQuoteAfter', 'u64'],
          ['amountIn', 'u64'],
          ['amountOut', 'u64'],
          ['protocolFee', 'u64'],
          ['platformFee', 'u64'],
          ['shareFee', 'u64'],
          ['tradeDirection', 'u8'],
          ['poolStatus', 'u8'],
        ],
      },
    ],
  ]);

  toObject(): RaydiumLCPTradeEvent {
    return {
      poolState: base58.encode(this.poolState),
      totalBaseSell: this.totalBaseSell,
      virtualBase: this.virtualBase,
      virtualQuote: this.virtualQuote,
      realBaseBefore: this.realBaseBefore,
      realQuoteBefore: this.realQuoteBefore,
      realBaseAfter: this.realBaseAfter,
      amountIn: this.amountIn,
      amountOut: this.amountOut,
      protocolFee: this.protocolFee,
      platformFee: this.platformFee,
      shareFee: this.shareFee,
      tradeDirection: this.tradeDirection,
      poolStatus: this.poolStatus,
      baseMint: '',
      quoteMint: '',
      user: '',
    };
  }
}
