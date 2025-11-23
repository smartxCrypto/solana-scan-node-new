import { PublicKey } from '@solana/web3.js';
import { JupiterSwapEvent } from '@/type';

export class JupiterSwapLayout {
  amm: Uint8Array;
  inputMint: Uint8Array;
  inputAmount: bigint;
  outputMint: Uint8Array;
  outputAmount: bigint;

  constructor(fields: {
    amm: Uint8Array;
    inputMint: Uint8Array;
    inputAmount: bigint;
    outputMint: Uint8Array;
    outputAmount: bigint;
  }) {
    this.amm = fields.amm;
    this.inputMint = fields.inputMint;
    this.inputAmount = fields.inputAmount;
    this.outputMint = fields.outputMint;
    this.outputAmount = fields.outputAmount;
  }

  static schema = new Map([
    [
      JupiterSwapLayout,
      {
        kind: 'struct',
        fields: [
          ['amm', [32]],
          ['inputMint', [32]],
          ['inputAmount', 'u64'],
          ['outputMint', [32]],
          ['outputAmount', 'u64'],
        ],
      },
    ],
  ]);

  toSwapEvent(): JupiterSwapEvent {
    return {
      amm: new PublicKey(this.amm),
      inputMint: new PublicKey(this.inputMint),
      inputAmount: this.inputAmount,
      outputMint: new PublicKey(this.outputMint),
      outputAmount: this.outputAmount,
    };
  }
}
