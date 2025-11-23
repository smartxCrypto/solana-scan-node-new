import { DISCRIMINATORS } from '@/constant';
import { PoolEventType } from '@/type';
import { RaydiumLiquidityParserBase, ParseEventConfig } from '@/collection/parser/ray/lp-base';
import { Buffer } from "node:buffer";

export class RaydiumV4PoolParser extends RaydiumLiquidityParserBase {
    public getPoolAction(data: Buffer): PoolEventType | null {
        const instructionType = data.slice(0, 1);
        if (instructionType.equals(DISCRIMINATORS.RAYDIUM.CREATE)) return 'CREATE';
        if (instructionType.equals(DISCRIMINATORS.RAYDIUM.ADD_LIQUIDITY)) return 'ADD';
        if (instructionType.equals(DISCRIMINATORS.RAYDIUM.REMOVE_LIQUIDITY)) return 'REMOVE';
        return null;
    }

    public getEventConfig(type: PoolEventType): ParseEventConfig {
        const configs = {
            CREATE: { eventType: 'CREATE' as const, poolIdIndex: 4, lpMintIndex: 7 },
            ADD: { eventType: 'ADD' as const, poolIdIndex: 1, lpMintIndex: 5 },
            REMOVE: { eventType: 'REMOVE' as const, poolIdIndex: 1, lpMintIndex: 5 },
        };
        return configs[type];
    }
}
