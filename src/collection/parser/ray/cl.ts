import { DISCRIMINATORS } from '@/constant';
import { PoolEventType } from '@/type';
import { RaydiumLiquidityParserBase, ParseEventConfig } from '@/collection/parser/ray/lp-base';
import { Buffer } from "node:buffer";

export class RaydiumCLPoolParser extends RaydiumLiquidityParserBase {
    public getPoolAction(data: Buffer): { name: string; type: PoolEventType } | null {
        const instructionType = data.slice(0, 8);

        for (const [name, discriminator] of Object.entries(DISCRIMINATORS.RAYDIUM_CL.CREATE)) {
            if (instructionType.equals(discriminator)) return { name, type: 'CREATE' };
        }

        for (const [name, discriminator] of Object.entries(DISCRIMINATORS.RAYDIUM_CL.ADD_LIQUIDITY)) {
            if (instructionType.equals(discriminator)) return { name, type: 'ADD' };
        }

        for (const [name, discriminator] of Object.entries(DISCRIMINATORS.RAYDIUM_CL.REMOVE_LIQUIDITY)) {
            if (instructionType.equals(discriminator)) return { name, type: 'REMOVE' };
        }

        return null;
    }

    public getEventConfig(type: PoolEventType, instructionType: { name: string; type: PoolEventType }): ParseEventConfig {
        const configs = {
            CREATE: {
                eventType: 'CREATE' as const,
                poolIdIndex: ['openPosition', 'openPositionV2'].includes(instructionType.name) ? 5 : 4,
                lpMintIndex: ['openPosition', 'openPositionV2'].includes(instructionType.name) ? 5 : 4,
            },
            ADD: {
                eventType: 'ADD' as const,
                poolIdIndex: 2,
                lpMintIndex: 2,
                tokenAmountOffsets: { token0: 32, token1: 24, lp: 8 },
            },
            REMOVE: {
                eventType: 'REMOVE' as const,
                poolIdIndex: 3,
                lpMintIndex: 3,
                tokenAmountOffsets: { token0: 32, token1: 24, lp: 8 },
            },
        };
        return configs[type];
    }
}
