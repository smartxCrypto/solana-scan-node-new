import { DISCRIMINATORS, TOKENS } from '@/constant';
import { PoolEvent, PoolEventType, TransferData } from '@/type';
import { MeteoraLiquidityParserBase } from '@/collection/parser/meteora/lp-base';
import { Buffer } from "node:buffer";

export class MeteoraDLMMPoolParser extends MeteoraLiquidityParserBase {
    public getPoolAction(data: Buffer): { name: string; type: PoolEventType } | null {
        const instructionType = data.slice(0, 8);

        for (const [name, discriminator] of Object.entries(DISCRIMINATORS.METEORA_DLMM.ADD_LIQUIDITY)) {
            if (instructionType.equals(discriminator)) {
                return { name, type: 'ADD' };
            }
        }

        for (const [name, discriminator] of Object.entries(DISCRIMINATORS.METEORA_DLMM.REMOVE_LIQUIDITY)) {
            if (instructionType.equals(discriminator)) {
                return { name, type: 'REMOVE' };
            }
        }

        return null;
    }

    protected parseAddLiquidityEvent(
        instruction: any,
        index: number,
        data: Buffer,
        transfers: TransferData[]
    ): PoolEvent {
        const [token0, token1] = this.normalizeTokens(transfers);
        const programId = this.adapter.getInstructionProgramId(instruction);
        const accounts = this.adapter.getInstructionAccounts(instruction);
        return {
            ...this.adapter.getPoolEventBase('ADD', programId),
            idx: index.toString(),
            poolId: accounts[1],
            poolLpMint: accounts[1],
            token0Mint: token0?.info.mint,
            token1Mint: token1?.info.mint,
            token0Amount: token0?.info.tokenAmount.uiAmount || 0,
            token0AmountRaw: token0?.info.tokenAmount.amount,
            token1Amount: token1?.info.tokenAmount.uiAmount || 0,
            token1AmountRaw: token1?.info.tokenAmount.amount,
            token0Decimals: token0 && this.adapter.getTokenDecimals(token0?.info.mint),
            token1Decimals: token1 && this.adapter.getTokenDecimals(token1?.info.mint),
            slot: Number(this.adapter.slot),
        };
    }

    protected parseRemoveLiquidityEvent(
        instruction: any,
        index: number,
        data: Buffer,
        transfers: TransferData[]
    ): PoolEvent {
        const accounts = this.adapter.getInstructionAccounts(instruction);
        let [token0, token1] = this.normalizeTokens(transfers);

        if (token1 == undefined && token0?.info.mint == accounts[8]) {
            token1 = token0;
            token0 = undefined;
        } else if (token0 == undefined && token1?.info.mint == accounts[7]) {
            token0 = token1;
            token1 = undefined;
        }
        const token0Mint = token0?.info.mint || accounts[7];
        const token1Mint = token1?.info.mint || accounts[8];
        const programId = this.adapter.getInstructionProgramId(instruction);
        return {
            ...this.adapter.getPoolEventBase('REMOVE', programId),
            idx: index.toString(),
            poolId: accounts[1],
            poolLpMint: accounts[1],
            token0Mint: token0?.info.mint || accounts[7],
            token1Mint: token1?.info.mint || accounts[8],
            token0Amount: token0?.info.tokenAmount.uiAmount || 0,
            token0AmountRaw: token0?.info.tokenAmount.amount,
            token1Amount: token1?.info.tokenAmount.uiAmount || 0,
            token1AmountRaw: token1?.info.tokenAmount.amount,
            token0Decimals: this.adapter.getTokenDecimals(token0Mint),
            token1Decimals: this.adapter.getTokenDecimals(token1Mint),
            slot: Number(this.adapter.slot),
        };
    }

    private normalizeTokens(transfers: TransferData[]): [TransferData | undefined, TransferData | undefined] {
        let [token0, token1] = this.utils.getLPTransfers(transfers);
        if (transfers.length === 1 && transfers[0].info.mint == TOKENS.SOL) {
            token1 = transfers[0];
            token0 = null as unknown as TransferData;
        }
        return [token0, token1];
    }
}
