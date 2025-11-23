import base58 from 'bs58';
import { BinaryReader } from '@/collection/parser/binary-reader';
import { Buffer } from "node:buffer";

export class JupiterLimitOrderV2TradeLayout {
  orderKey: Uint8Array;
  taker: Uint8Array;
  remainingMakingAmount: bigint;
  remainingTakingAmount: bigint;
  makingAmount: bigint;
  takingAmount: bigint;

  constructor(fields: {
    orderKey: Uint8Array;
    taker: Uint8Array;
    remainingMakingAmount: bigint;
    remainingTakingAmount: bigint;
    makingAmount: bigint;
    takingAmount: bigint;
  }) {
    this.orderKey = fields.orderKey;
    this.taker = fields.taker;
    this.remainingMakingAmount = fields.remainingMakingAmount;
    this.remainingTakingAmount = fields.remainingTakingAmount;
    this.makingAmount = fields.makingAmount;
    this.takingAmount = fields.takingAmount;
  }

  static schema = new Map([
    [
      JupiterLimitOrderV2TradeLayout,
      {
        kind: 'struct',
        fields: [
          ['orderKey', [32]],
          ['taker', [32]],
          ['remainingMakingAmount', 'u64'],
          ['remainingTakingAmount', 'u64'],
          ['makingAmount', 'u64'],
          ['takingAmount', 'u64'],
        ],
      },
    ],
  ]);

  toObject() {
    return {
      orderKey: base58.encode(this.orderKey),
      taker: base58.encode(this.taker),
      remainingMakingAmount: this.remainingMakingAmount,
      remainingTakingAmount: this.remainingTakingAmount,
      makingAmount: this.makingAmount,
      takingAmount: this.takingAmount,
    };
  }
}

export class JupiterLimitOrderV2CreateOrderLayout {
  orderKey: Uint8Array;
  maker: Uint8Array;
  inputMint: Uint8Array;
  outputMint: Uint8Array;
  inputTokenProgram: Uint8Array;
  outputTokenProgram: Uint8Array;
  makingAmount: bigint;
  takingAmount: bigint;
  expiredAt: bigint | null;
  feeBps: number;
  feeAccount: Uint8Array;

  constructor(fields: {
    orderKey: Uint8Array;
    maker: Uint8Array;
    inputMint: Uint8Array;
    outputMint: Uint8Array;
    inputTokenProgram: Uint8Array;
    outputTokenProgram: Uint8Array;
    makingAmount: bigint;
    takingAmount: bigint;
    expiredAt: bigint | null;
    feeBps: number;
    feeAccount: Uint8Array;
  }) {
    this.orderKey = fields.orderKey;
    this.maker = fields.maker;
    this.inputMint = fields.inputMint;
    this.outputMint = fields.outputMint;
    this.inputTokenProgram = fields.inputTokenProgram;
    this.outputTokenProgram = fields.outputTokenProgram;
    this.makingAmount = fields.makingAmount;
    this.takingAmount = fields.takingAmount;
    this.expiredAt = fields.expiredAt;
    this.feeBps = fields.feeBps;
    this.feeAccount = fields.feeAccount;
  }

  static schema = new Map([
    [
      JupiterLimitOrderV2CreateOrderLayout,
      {
        kind: 'struct',
        fields: [
          ['orderKey', [32]],
          ['maker', [32]],
          ['inputMint', [32]],
          ['outputMint', [32]],
          ['inputTokenProgram', [32]],
          ['outputTokenProgram', [32]],
          ['makingAmount', 'u64'],
          ['takingAmount', 'u64'],
          ['expiredAt', { option: 'i64' }],
          ['feeBps', 'u16'],
          ['feeAccount', [32]],
        ],
      },
    ],
  ]);

  static deserialize(data: Buffer): JupiterLimitOrderV2CreateOrderLayout {
    const reader = new BinaryReader(data);

    const orderKey = reader.readFixedArray(32);
    const maker = reader.readFixedArray(32);
    const inputMint = reader.readFixedArray(32);
    const outputMint = reader.readFixedArray(32);
    const inputTokenProgram = reader.readFixedArray(32);
    const outputTokenProgram = reader.readFixedArray(32);
    const makingAmount = reader.readU64();
    const takingAmount = reader.readU64();

    // Handle optional expiredAt
    const expiredAtDiscriminator = reader.readU8(); // Read 1-byte discriminator
    let expiredAt: bigint | null = null;
    if (expiredAtDiscriminator === 1) {
      expiredAt = reader.readI64(); // Read i64 only if value is present
    }
    const feeBps = reader.readU16();
    const feeAccount = reader.readFixedArray(32);

    return new JupiterLimitOrderV2CreateOrderLayout({
      orderKey,
      maker,
      inputMint,
      outputMint,
      inputTokenProgram,
      outputTokenProgram,
      makingAmount,
      takingAmount,
      expiredAt,
      feeBps,
      feeAccount,
    });
  }

  toObject() {
    return {
      orderKey: base58.encode(this.orderKey),
      maker: base58.encode(this.maker),
      inputMint: base58.encode(this.inputMint),
      outputMint: base58.encode(this.outputMint),
      inputTokenProgram: base58.encode(this.inputTokenProgram),
      outputTokenProgram: base58.encode(this.outputTokenProgram),
      makingAmount: this.makingAmount,
      takingAmount: this.takingAmount,
      expiredAt: this.expiredAt !== null ? this.expiredAt.toString() : null,
      feeBps: this.feeBps,
      feeAccount: base58.encode(this.feeAccount),
    };
  }
}
