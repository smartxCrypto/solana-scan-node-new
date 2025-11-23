import base58 from 'bs58';

export class JupiterDCAFilledLayout {
  userKey: Uint8Array;
  dcaKey: Uint8Array;
  inputMint: Uint8Array;
  outputMint: Uint8Array;
  inAmount: bigint;
  outAmount: bigint;
  feeMint: Uint8Array;
  fee: bigint;

  constructor(fields: {
    userKey: Uint8Array;
    dcaKey: Uint8Array;
    inputMint: Uint8Array;
    outputMint: Uint8Array;
    inAmount: bigint;
    outAmount: bigint;
    feeMint: Uint8Array;
    fee: bigint;
  }) {
    this.userKey = fields.userKey;
    this.dcaKey = fields.dcaKey;
    this.inputMint = fields.inputMint;
    this.outputMint = fields.outputMint;
    this.inAmount = fields.inAmount;
    this.outAmount = fields.outAmount;
    this.feeMint = fields.feeMint;
    this.fee = fields.fee;
  }

  static schema = new Map([
    [
      JupiterDCAFilledLayout,
      {
        kind: 'struct',
        fields: [
          ['userKey', [32]],
          ['dcaKey', [32]],
          ['inputMint', [32]],
          ['outputMint', [32]],
          ['inAmount', 'u64'],
          ['outAmount', 'u64'],
          ['feeMint', [32]],
          ['fee', 'u64'],
        ],
      },
    ],
  ]);

  toObject() {
    return {
      userKey: base58.encode(this.userKey),
      dcaKey: base58.encode(this.dcaKey),
      inputMint: base58.encode(this.inputMint),
      outputMint: base58.encode(this.outputMint),
      inAmount: this.inAmount,
      outAmount: this.outAmount,
      feeMint: base58.encode(this.feeMint),
      fee: this.fee,
    };
  }
}
