import base58 from 'bs58';
import { BinaryReader } from '@/collection/parser/binary-reader';
import { Buffer } from "node:buffer";

export class JupiterVAFillLayout {
  valueAverage: Uint8Array;
  user: Uint8Array;
  keeper: Uint8Array;
  inputMint: Uint8Array;
  outputMint: Uint8Array;
  inputAmount: bigint;
  outputAmount: bigint;
  fee: bigint;
  newActualUsdcValue: bigint;
  supposedUsdcValue: bigint;
  value: bigint;
  inLeft: bigint;
  inUsed: bigint;
  outReceived: bigint;

  constructor(fields: {
    valueAverage: Uint8Array;
    user: Uint8Array;
    keeper: Uint8Array;
    inputMint: Uint8Array;
    outputMint: Uint8Array;
    inputAmount: bigint;
    outputAmount: bigint;
    fee: bigint;
    newActualUsdcValue: bigint;
    supposedUsdcValue: bigint;
    value: bigint;
    inLeft: bigint;
    inUsed: bigint;
    outReceived: bigint;
  }) {
    this.valueAverage = fields.valueAverage;
    this.user = fields.user;
    this.keeper = fields.keeper;
    this.inputMint = fields.inputMint;
    this.outputMint = fields.outputMint;
    this.inputAmount = fields.inputAmount;
    this.outputAmount = fields.outputAmount;
    this.fee = fields.fee;
    this.newActualUsdcValue = fields.newActualUsdcValue;
    this.supposedUsdcValue = fields.supposedUsdcValue;
    this.value = fields.value;
    this.inLeft = fields.inLeft;
    this.inUsed = fields.inUsed;
    this.outReceived = fields.outReceived;
  }

  static schema = new Map([
    [
      JupiterVAFillLayout,
      {
        kind: 'struct',
        fields: [
          ['valueAverage', [32]],
          ['user', [32]],
          ['keeper', [32]],
          ['inputMint', [32]],
          ['outputMint', [32]],
          ['inputAmount', 'u64'],
          ['outputAmount', 'u64'],
          ['fee', 'u64'],
          ['newActualUsdcValue', 'u64'],
          ['supposedUsdcValue', 'u64'],
          ['value', 'u64'],
          ['inLeft', 'u64'],
          ['inUsed', 'u64'],
          ['outReceived', 'u64'],
        ],
      },
    ],
  ]);

  toObject() {
    return {
      valueAverage: base58.encode(this.valueAverage),
      user: base58.encode(this.user),
      keeper: base58.encode(this.keeper),
      inputMint: base58.encode(this.inputMint),
      outputMint: base58.encode(this.outputMint),
      inputAmount: this.inputAmount,
      outputAmount: this.outputAmount,

      fee: this.fee,
      newActualUsdcValue: this.newActualUsdcValue,
      supposedUsdcValue: this.supposedUsdcValue,
      value: this.value,
      inLeft: this.inLeft,
      inUsed: this.inUsed,
      outReceived: this.outReceived,
    };
  }
}

export class JupiterVAOpenLayout {
  user: Uint8Array;
  valueAverage: Uint8Array;
  deposit: bigint;
  inputMint: Uint8Array;
  outputMint: Uint8Array;
  referralFeeAccount: Uint8Array;
  orderInterval: bigint;
  incrementUsdcValue: bigint;
  createdAt: bigint;

  constructor(fields: {
    user: Uint8Array;
    valueAverage: Uint8Array;
    deposit: bigint;
    inputMint: Uint8Array;
    outputMint: Uint8Array;
    referralFeeAccount: Uint8Array;
    orderInterval: bigint;
    incrementUsdcValue: bigint;
    createdAt: bigint;
  }) {
    this.user = fields.user;
    this.valueAverage = fields.valueAverage;
    this.deposit = fields.deposit;
    this.inputMint = fields.inputMint;
    this.outputMint = fields.outputMint;
    this.referralFeeAccount = fields.referralFeeAccount;
    this.orderInterval = fields.orderInterval;
    this.incrementUsdcValue = fields.incrementUsdcValue;
    this.createdAt = fields.createdAt;
  }

  static schema = new Map([
    [
      JupiterVAOpenLayout,
      {
        kind: 'struct',
        fields: [
          ['user', [32]],
          ['valueAverage', [32]],
          ['deposit', 'u64'],
          ['inputMint', [32]],
          ['outputMint', [32]],
          ['referralFeeAccount', [32]],
          ['orderInterval', 'i64'],
          ['incrementUsdcValue', 'u64'],
          ['createdAt', 'i64'],
        ],
      },
    ],
  ]);

  static deserialize(data: Buffer): JupiterVAOpenLayout {
    const reader = new BinaryReader(data);

    const user = reader.readFixedArray(32);
    const valueAverage = reader.readFixedArray(32);
    const deposit = reader.readU64();
    const inputMint = reader.readFixedArray(32);
    const outputMint = reader.readFixedArray(32);
    const referralFeeAccount = reader.readFixedArray(32);
    const orderInterval = reader.readI64();
    const incrementUsdcValue = reader.readU64();
    const createdAt = reader.readI64();

    return new JupiterVAOpenLayout({
      user,
      valueAverage,
      deposit,
      inputMint,
      outputMint,
      referralFeeAccount,
      orderInterval,
      incrementUsdcValue,
      createdAt,
    });
  }

  toObject() {
    return {
      user: base58.encode(this.user),
      valueAverage: base58.encode(this.valueAverage),
      deposit: this.deposit,
      inputMint: base58.encode(this.inputMint),
      outputMint: base58.encode(this.outputMint),
      referralFeeAccount: base58.encode(this.referralFeeAccount),
      orderInterval: this.orderInterval,
      incrementUsdcValue: this.incrementUsdcValue,
      createdAt: this.createdAt,
    };
  }
}

export class JupiterVADepositLayout {
  depositor: Uint8Array;
  valueAverage: Uint8Array;
  mint: Uint8Array;
  amount: bigint;
  inDeposited: bigint;
  inLeft: bigint;

  constructor(fields: {
    depositor: Uint8Array;
    valueAverage: Uint8Array;
    mint: Uint8Array;
    amount: bigint;
    inDeposited: bigint;
    inLeft: bigint;
  }) {
    this.depositor = fields.depositor;
    this.valueAverage = fields.valueAverage;
    this.mint = fields.mint;
    this.amount = fields.amount;
    this.inDeposited = fields.inDeposited;
    this.inLeft = fields.inLeft;
  }

  static schema = new Map([
    [
      JupiterVADepositLayout,
      {
        kind: 'struct',
        fields: [
          ['depositor', [32]],
          ['valueAverage', [32]],
          ['mint', [32]],
          ['amount', 'u64'],
          ['inDeposited', 'u64'],
          ['inLeft', 'u64'],
        ],
      },
    ],
  ]);

  toObject() {
    return {
      depositor: base58.encode(this.depositor),
      valueAverage: base58.encode(this.valueAverage),
      mint: base58.encode(this.mint),
      amount: this.amount,
      inDeposited: this.inDeposited,
      inLeft: this.inLeft,
    };
  }
}

export class JupiterVAWithdrawLayout {
  valueAverage: Uint8Array;
  mint: Uint8Array;
  amount: bigint;
  inOrOut: string;
  userWithdraw: boolean;
  inLeft: bigint;
  inWithdrawn: bigint;
  outWithdrawn: bigint;

  constructor(fields: {
    valueAverage: Uint8Array;
    mint: Uint8Array;
    amount: bigint;
    inOrOut: string;
    userWithdraw: boolean;
    inLeft: bigint;
    inWithdrawn: bigint;
    outWithdrawn: bigint;
  }) {
    this.valueAverage = fields.valueAverage;
    this.mint = fields.mint;
    this.amount = fields.amount;
    this.inOrOut = fields.inOrOut;
    this.userWithdraw = fields.userWithdraw;
    this.inLeft = fields.inLeft;
    this.inWithdrawn = fields.inWithdrawn;
    this.outWithdrawn = fields.outWithdrawn;
  }

  static deserialize(data: Buffer): JupiterVAWithdrawLayout {
    const reader = new BinaryReader(data);

    const valueAverage = reader.readFixedArray(32);
    const mint = reader.readFixedArray(32);
    const amount = reader.readU64();
    const inOrOut = reader.readU8() == 0 ? 'In' : 'Out';
    const userWithdraw = reader.readU8() === 1;
    const inLeft = reader.readU64();
    const inWithdrawn = reader.readU64();
    const outWithdrawn = reader.readU64();

    return new JupiterVAWithdrawLayout({
      valueAverage,
      mint,
      amount,
      inOrOut,
      userWithdraw,
      inLeft,
      inWithdrawn,
      outWithdrawn,
    });
  }
  toObject() {
    return {
      valueAverage: base58.encode(this.valueAverage),
      mint: base58.encode(this.mint),
      amount: this.amount,
      inOrOut: this.inOrOut,
      userWithdraw: this.userWithdraw,
      inLeft: this.inLeft,
      inWithdrawn: this.inWithdrawn,
      outWithdrawn: this.outWithdrawn,
    };
  }
}

export class JupiterVACloseLayout {
  user: Uint8Array;
  valueAverage: Uint8Array;
  createdAt: bigint;
  closedAt: bigint;
  executor: Uint8Array;

  constructor(fields: {
    user: Uint8Array;
    valueAverage: Uint8Array;
    createdAt: bigint;
    closedAt: bigint;
    executor: Uint8Array;
  }) {
    this.user = fields.user;
    this.valueAverage = fields.valueAverage;
    this.createdAt = fields.createdAt;
    this.closedAt = fields.closedAt;
    this.executor = fields.executor;
  }

  static schema = new Map([
    [
      JupiterVACloseLayout,
      {
        kind: 'struct',
        fields: [
          ['user', [32]],
          ['valueAverage', [32]],
          ['createdAt', 'i64'],
          ['closedAt', 'i64'],
          ['executor', [32]],
        ],
      },
    ],
  ]);

  toObject() {
    return {
      user: base58.encode(this.user),
      valueAverage: base58.encode(this.valueAverage),
      createdAt: this.createdAt,
      closedAt: this.closedAt,
      executor: base58.encode(this.executor),
    };
  }
}
