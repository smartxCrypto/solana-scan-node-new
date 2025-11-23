import { DISCRIMINATORS } from '@/constant';
import { PoolEventType } from '@/type';
import { RaydiumLiquidityParserBase, ParseEventConfig } from '@/collection/parser/ray/lp-base';
import { Buffer } from "node:buffer";

export class RaydiumCPMMPoolParser extends RaydiumLiquidityParserBase {
    public getPoolAction(data: Buffer): PoolEventType | null {
        const instructionType = data.slice(0, 8);
        if (instructionType.equals(DISCRIMINATORS.RAYDIUM_CPMM.CREATE)) return 'CREATE';
        if (instructionType.equals(DISCRIMINATORS.RAYDIUM_CPMM.ADD_LIQUIDITY)) return 'ADD';
        if (instructionType.equals(DISCRIMINATORS.RAYDIUM_CPMM.REMOVE_LIQUIDITY)) return 'REMOVE';
        return null;
    }

    public getEventConfig(type: PoolEventType): ParseEventConfig {
        const configs = {
            CREATE: {
                eventType: 'CREATE' as const,
                poolIdIndex: 3,
                lpMintIndex: 6,
                tokenAmountOffsets: { token0: 8, token1: 16, lp: 0 },
            },
            ADD: {
                eventType: 'ADD' as const,
                poolIdIndex: 2,
                lpMintIndex: 12,
                tokenAmountOffsets: { token0: 16, token1: 24, lp: 8 },
            },
            REMOVE: {
                eventType: 'REMOVE' as const,
                poolIdIndex: 2,
                lpMintIndex: 12,
                tokenAmountOffsets: { token0: 16, token1: 24, lp: 8 },
            },
        };
        return configs[type];
    }
}
