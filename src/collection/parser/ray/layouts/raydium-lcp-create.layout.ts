import base58 from 'bs58';
import { Buffer } from 'node:buffer';
import {
  ConstantCurve,
  CurveParams,
  CurveType,
  FixedCurve,
  LinearCurve,
  MintParams,
  RaydiumLCPCreateEvent,
  VestingParams,
} from '@/type';
import { BinaryReader } from '@/collection/parser/binary-reader';

// PoolCreateEventLayout
export class PoolCreateEventLayout {
  poolState: Uint8Array;
  creator: Uint8Array;
  config: Uint8Array;
  baseMintParam: MintParams;
  curveParam: CurveParams;
  vestingParam: VestingParams;

  constructor(fields: {
    poolState: Uint8Array;
    creator: Uint8Array;
    config: Uint8Array;
    baseMintParam: MintParams;
    curveParam: CurveParams;
    vestingParam: VestingParams;
  }) {
    this.poolState = fields.poolState;
    this.creator = fields.creator;
    this.config = fields.config;
    this.baseMintParam = fields.baseMintParam;
    this.curveParam = fields.curveParam;
    this.vestingParam = fields.vestingParam;
  }

  // Deserialize with BinaryReader
  static deserialize(data: Buffer): PoolCreateEventLayout {
    const reader = new BinaryReader(data);

    // Read fields
    const poolState = reader.readFixedArray(32);
    const creator = reader.readFixedArray(32);
    const config = reader.readFixedArray(32);

    // Read baseMintParam
    const baseMintParam: MintParams = {
      decimals: reader.readU8(),
      name: reader.readString(),
      symbol: reader.readString(),
      uri: reader.readString(),
    };

    // Read curveParam
    const variant = reader.readU8();
    let curveParam: CurveParams;
    try {
      if (variant === CurveType.Constant) {
        const data: ConstantCurve = {
          supply: reader.readU64(),
          totalBaseSell: reader.readU64(),
          totalQuoteFundRaising: reader.readU64(),
          migrateType: reader.readU8(),
        };
        curveParam = { variant: 'Constant', data };
      } else if (variant === CurveType.Fixed) {
        const data: FixedCurve = {
          supply: reader.readU64(),
          totalQuoteFundRaising: reader.readU64(),
          migrateType: reader.readU8(),
        };
        curveParam = { variant: 'Fixed', data };
      } else if (variant === CurveType.Linear) {
        const data: LinearCurve = {
          supply: reader.readU64(),
          totalQuoteFundRaising: reader.readU64(),
          migrateType: reader.readU8(),
        };
        curveParam = { variant: 'Linear', data };
      } else {
        throw new Error(`Unknown CurveParams variant: ${variant}`);
      }
    } catch (error) {
      console.error(`Failed to decode CurveParams at offset ${reader.getOffset()}:`, error);
      throw error;
    }

    // Read vestingParam
    const vestingParam: VestingParams = {
      totalLockedAmount: reader.readU64(),
      cliffPeriod: reader.readU64(),
      unlockPeriod: reader.readU64(),
    };

    return new PoolCreateEventLayout({
      poolState,
      creator,
      config,
      baseMintParam,
      curveParam,
      vestingParam,
    });
  }

  toObject(): RaydiumLCPCreateEvent {
    return {
      poolState: base58.encode(this.poolState),
      creator: base58.encode(this.creator),
      config: base58.encode(this.config),
      baseMintParam: {
        decimals: this.baseMintParam.decimals,
        name: this.baseMintParam.name,
        symbol: this.baseMintParam.symbol,
        uri: this.baseMintParam.uri,
      },
      curveParam: {
        variant: this.curveParam.variant,
        data: {
          supply: BigInt(this.curveParam.data.supply),
          totalBaseSell:
            'totalBaseSell' in this.curveParam.data ? BigInt(this.curveParam.data.totalBaseSell) : undefined,
          totalQuoteFundRaising: BigInt(this.curveParam.data.totalQuoteFundRaising),
          migrateType: this.curveParam.data.migrateType,
        },
      },
      vestingParam: {
        totalLockedAmount: BigInt(this.vestingParam.totalLockedAmount),
        cliffPeriod: BigInt(this.vestingParam.cliffPeriod),
        unlockPeriod: BigInt(this.vestingParam.unlockPeriod),
      },
      baseMint: '', // Initialize baseMint to an empty string
      quoteMint: '', // Initialize quoteMint to an empty string
    };
  }
}
