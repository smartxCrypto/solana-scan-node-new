import {
    ParsedInstruction,
    ParsedTransactionWithMeta,
    PartiallyDecodedInstruction,
    PublicKey,
} from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha256';
import { Buffer } from 'node:buffer';


import base58 from 'bs58';
import { DEX_PROGRAMS, TOKEN_PROGRAM_ID, TOKENS } from '../constant/index';
import { ClassifiedInstruction, convertToUiAmount, DexInfo, TradeInfo, TradeType } from '../type/index';
import solana_connect_instance from "./solana";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

/**
 * Get instruction data
 */
export const getInstructionData = (instruction: any): Buffer => {
    if ('data' in instruction) {
        if (typeof instruction.data === 'string') return Buffer.from(base58.decode(instruction.data)); // compatible with both bs58 v4.0.1 and v6.0.0
        if (instruction.data instanceof Uint8Array) return Buffer.from(instruction.data);
    }
    return instruction.data;
};

/**
 * Get the name of a program by its ID
 * @param programId - The program ID to look up
 * @returns The name of the program or 'Unknown' if not found
 */
export const getProgramName = (programId: string): string =>
    Object.values(DEX_PROGRAMS).find((dex) => dex.id === programId)?.name || 'Unknown';

/**
 * Convert a hex string to Uint8Array
 * @param hex - Hex string to convert
 * @returns Uint8Array representation of the hex string
 */
export const hexToUint8Array = (hex: string): Uint8Array =>
    new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

export const absBigInt = (value: bigint): bigint => {
    return value < 0n ? -value : value;
};

export const getTradeType = (inMint: string, outMint: string): TradeType => {
    if (inMint == TOKENS.SOL) return 'BUY';
    if (outMint == TOKENS.SOL) return 'SELL';
    if (Object.values(TOKENS).includes(inMint)) return 'BUY';
    return 'SELL';
};

export const getAMMs = (transferActionKeys: string[]) => {
    const amms = Object.values(DEX_PROGRAMS).filter((it) => it.tags.includes('amm'));
    return transferActionKeys
        .map((it) => {
            const item = Object.values(amms).find((amm) => it.split(':')[0] == amm.id);
            if (item) return item.name;
            return null;
        })
        .filter((it) => it != null);
};

export const getTranferTokenMint = (token1?: string, token2?: string): string | undefined => {
    if (token1 == token2) return token1;
    if (token1 && token1 != TOKENS.SOL) return token1;
    if (token2 && token2 != TOKENS.SOL) return token2;
    return token1 || token2;
};

export const getPubkeyString = (value: any): string => {
    if (typeof value === 'string') return value;
    if (value instanceof PublicKey) return value.toBase58();
    if ('type' in value && value.type == 'Buffer') return base58.encode(value.data);
    if (value instanceof Buffer) return base58.encode(value);
    return value;
};

// ... existing code ...

/**
 * Sort an array of TradeInfo objects by their idx field
 * The idx format is 'main-sub', such as '1-0', '2-1', etc.
 * @param items The TradeInfo array to be sorted
 * @returns The sorted TradeInfo array
 */
export const sortByIdx = <T extends { idx: string }>(items: T[]): T[] => {
    return items && items.length > 1
        ? [...items].sort((a, b) => {
            const [aMain, aSub = '0'] = a.idx.split('-');
            const [bMain, bSub = '0'] = b.idx.split('-');
            const mainDiff = parseInt(aMain) - parseInt(bMain);
            if (mainDiff !== 0) return mainDiff;
            return parseInt(aSub) - parseInt(bSub);
        })
        : items;
};

export const getFinalSwap = (trades: TradeInfo[], dexInfo?: DexInfo): TradeInfo | null => {
    if (trades.length == 1) return trades[0];
    if (trades.length >= 2) {
        // sort by idx
        if (trades.length > 2) {
            trades = sortByIdx(trades);
        }

        const inputTrade = trades[0];
        const outputTrade = trades[trades.length - 1];

        if (trades.length >= 2) {
            // Merge trades
            let [inputAmount, outputAmount] = [0n, 0n];
            for (const trade of trades) {
                if (trade.inputToken.mint == inputTrade.inputToken.mint) {
                    inputAmount += BigInt(trade.inputToken.amountRaw);
                }
                if (trade.outputToken.mint == outputTrade.outputToken.mint) {
                    outputAmount += BigInt(trade.outputToken.amountRaw);
                }
            }

            inputTrade.inputToken.amountRaw = inputAmount.toString();
            inputTrade.inputToken.amount = convertToUiAmount(inputAmount, inputTrade.inputToken.decimals);

            outputTrade.outputToken.amountRaw = outputAmount.toString();
            outputTrade.outputToken.amount = convertToUiAmount(outputAmount, outputTrade.outputToken.decimals);
        }

        return {
            type: getTradeType(inputTrade.inputToken.mint, outputTrade.outputToken.mint),
            inputToken: inputTrade.inputToken,
            outputToken: outputTrade.outputToken,
            user: inputTrade.user,
            programId: inputTrade.programId,
            amm: dexInfo?.amm || inputTrade.amm,
            route: dexInfo?.route || inputTrade.route || '',
            slot: inputTrade.slot,
            timestamp: inputTrade.timestamp,
            signature: inputTrade.signature,
            idx: inputTrade.idx,
        } as TradeInfo;
    }
    return null;
};



export const anchorLogScanner = (logs: string[], programId: string) => {
    const executionStack: string[] = [];
    const programEvents: { [key: string]: string[] } = {};

    for (const log of logs) {
        if (log.includes('invoke')) {
            const program = log.split(' ')[1];
            executionStack.push(program);
            if (programEvents[program] == undefined) {
                programEvents[program] = [];
            }
        } else {
            const currentProgram = executionStack[executionStack.length - 1];
            if (log.match(/^Program (.*) success/g) !== null) {
                executionStack.pop();
                continue;
            }
            if (currentProgram == programId) {
                if (log.startsWith('Program data: ')) {
                    const data = log.split('Program data: ')[1];
                    programEvents[currentProgram].push(data);
                }
                continue;
            }
        }
    }
    console.log(programEvents);

    return programEvents[programId];
};

export const createAnchorSigHash = (sig: string) => {
    return Buffer.from(sha256(sig).slice(0, 8));
};

export const flattenTransactionInstructions = (transaction: ParsedTransactionWithMeta) => {
    // Takes a parsed transaction and creates a sorted array of all the instructions (including cpi calls)
    let txnIxs = transaction.transaction.message.instructions;
    let cpiIxs = transaction.meta?.innerInstructions?.sort((a, b) => a.index - b.index) || [];
    const totalCalls = cpiIxs.reduce((acc, ix) => acc + ix.instructions.length, 0) + txnIxs.length;

    const flattended = [];
    let lastPushedIx = -1;
    let currCallIndex = -1;
    for (const cpiIx of cpiIxs) {
        while (lastPushedIx != cpiIx.index) {
            lastPushedIx += 1;
            currCallIndex += 1;
            flattended.push(txnIxs[lastPushedIx]);
        }
        for (const innerIx of cpiIx.instructions) {
            flattended.push(innerIx);
            currCallIndex += 1;
        }
    }
    while (currCallIndex < totalCalls - 1) {
        lastPushedIx += 1;
        currCallIndex += 1;
        flattended.push(txnIxs[lastPushedIx]);
    }
    return flattended;
};

export const getAccountSOLBalanceChange = (
    transaction: ParsedTransactionWithMeta,
    account: PublicKey
) => {
    const accountIndex = transaction.transaction.message.accountKeys.findIndex(
        (acct) => acct.pubkey.toString() == account.toString()
    );
    if (accountIndex == -1) return 0;
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    return Math.abs(postBalances[accountIndex] - preBalances[accountIndex]);
};

export const getSplTransfers = (
    instructions: (ParsedInstruction | PartiallyDecodedInstruction)[]
) => {
    return instructions.filter(
        (ix) =>
            ix.programId.toString() == 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' &&
            // @ts-ignore
            ix.parsed.type == 'transfer'
    );
};

export const getSOLTransfers = (
    instructions: (ParsedInstruction | PartiallyDecodedInstruction)[]
) => {
    return instructions.filter(
        (ix) =>
            ix.programId.toString() == '11111111111111111111111111111111' &&
            // @ts-ignore
            ix.parsed.type == 'transfer'
    );
};



export const getBlockValue = async (blockNumber: number) => {
    const connection = solana_connect_instance.getConnection();
    const block = await connection.getBlock(blockNumber, {
        maxSupportedTransactionVersion: 0,
    });
    return block;
}

// GetAssociatedTokenAddress
export const findAssociatedTokenAddress = (
    walletAddress: PublicKey,
    tokenMintAddress: PublicKey,
): { standard: PublicKey; token2022: PublicKey } => {
    const [standardATA] = PublicKey.findProgramAddressSync(
        [
            walletAddress.toBuffer(),
            new PublicKey(TOKEN_PROGRAM_ID).toBuffer(),
            tokenMintAddress.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const [token2022ATA] = PublicKey.findProgramAddressSync(
        [
            walletAddress.toBuffer(),
            new PublicKey(TOKEN_2022_PROGRAM_ID).toBuffer(),
            tokenMintAddress.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    return {
        standard: standardATA,
        token2022: token2022ATA
    };
};

export const GetAccountTradeType = (userAccount: PublicKey, baseMint: PublicKey, inputUserAcount: PublicKey, outputUserAccount: PublicKey): TradeType => {

    const { standard, token2022 } = findAssociatedTokenAddress(userAccount, baseMint)
    if (standard.equals(inputUserAcount) || token2022.equals(inputUserAcount)) {
        return 'SELL'
    } else if (standard.equals(outputUserAccount) || token2022.equals(outputUserAccount)) {
        return 'BUY'
    }

    return 'SWAP'
}

export const getPrevInstructionByIndex = (instructions: ClassifiedInstruction[], outerIndex: number, innerIndex?: number) => {
    for (let i = 0; i < instructions.length; i++) {
        const inst = instructions[i];
        if (inst.outerIndex == outerIndex && inst.innerIndex == innerIndex) {
            if (i > 0)
                return instructions[i - 1]
        }
    }
    return null;
}

export const decodeInstructionData = (data: any): Buffer => {
    if (typeof data === 'string') return Buffer.from(base58.decode(data)); // compatible with both bs58 v4.0.1 and v6.0.0
    if (data instanceof Uint8Array) return Buffer.from(data);
    if ('type' in data && data.type == 'Buffer') return Buffer.from(data.data);
    return data;
};