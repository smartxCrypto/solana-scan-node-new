import { PoolEvent, PoolEventType, TransferData } from '@/type';
import { BaseLiquidityParser } from '@/collection/parser/base-liquidity-parser';
import { getInstructionData } from '@/lib/utils';
import { Buffer } from "node:buffer";

export abstract class MeteoraLiquidityParserBase extends BaseLiquidityParser {
    abstract getPoolAction(data: Buffer): PoolEventType | { name: string; type: PoolEventType } | null;

    public processLiquidity(): PoolEvent[] {
        const events: PoolEvent[] = [];

        this.classifiedInstructions.forEach(({ instruction, programId, outerIndex, innerIndex }) => {
            const event = this.parseInstruction(instruction, programId, outerIndex, innerIndex);
            if (event) {
                events.push(event);
            }
        });

        return events;
    }

    protected parseInstruction(
        instruction: any,
        programId: string,
        outerIndex: number,
        innerIndex?: number
    ): PoolEvent | null {
        try {
            const data = getInstructionData(instruction);
            const action = this.getPoolAction(data);
            if (!action) return null;

            let transfers = this.getTransfersForInstruction(programId, outerIndex, innerIndex);
            if (transfers.length === 0) transfers = this.getTransfersForInstruction(programId, outerIndex, innerIndex ?? 0);
            const type = typeof action === 'string' ? action : action.type;
            switch (type) {
                case 'CREATE':
                    return this.parseCreateLiquidityEvent?.(instruction, outerIndex, data, transfers) ?? null;
                case 'ADD':
                    return this.parseAddLiquidityEvent(instruction, outerIndex, data, transfers);
                case 'REMOVE':
                    return this.parseRemoveLiquidityEvent(instruction, outerIndex, data, transfers);
                default:
                    return null;
            }
        } catch (error) {
            console.error('parseInstruction error:', error);
            throw error;
        }
    }

    protected abstract parseAddLiquidityEvent(
        instruction: any,
        index: number,
        data: Buffer,
        transfers: TransferData[]
    ): PoolEvent;

    protected abstract parseRemoveLiquidityEvent(
        instruction: any,
        index: number,
        data: Buffer,
        transfers: TransferData[]
    ): PoolEvent;

    protected parseCreateLiquidityEvent?(
        instruction: any,
        index: number,
        data: Buffer,
        transfers: TransferData[]
    ): PoolEvent;
}
