import base58 from 'bs58';
import { Buffer } from 'node:buffer';

export class BlockDataConverter {
    /**
     * 将 RPC getBlock 返回的数据转换为 gRPC 格式
     * 支持 legacy 交易和 V0 交易（使用 address lookup tables）
     */
    static convertRpcToGrpc(rpcBlock: any): any {
        return {
            slot: String(rpcBlock.slot),
            blockhash: rpcBlock.blockHash,
            blockTime: {
                timestamp: String(rpcBlock.blockTime),
            },
            blockHeight: undefined,
            parentSlot: String(rpcBlock.parentSlot),
            parentBlockhash: rpcBlock.blockHash,
            executedTransactionCount: String(rpcBlock.transactionCount),
            transactions: rpcBlock.transactions
                .map((tx: any) => this.convertTransaction(tx))
                .filter((tx: any) => tx !== null),
            updatedAccountCount: '0',
            accounts: [],
            entriesCount: '0',
            entries: [],
        };
    }

    private static convertTransaction(rpcTx: any): any | null {
        if (!rpcTx.transaction || !rpcTx.transaction.transaction || !rpcTx.transaction.transaction.message) {
            return null;
        }

        const txData = rpcTx.transaction.transaction;
        const message = txData.message;
        const isVote = this.isVoteTransaction(rpcTx);

        // 处理 accountKeys：gRPC 不展开 addressTableLookups
        const staticKeys = message.staticAccountKeys || message.accountKeys || [];
        const hasAddressLookups = message.addressTableLookups && message.addressTableLookups.length > 0;

        let allAccountKeys: string[];
        if (hasAddressLookups) {
            allAccountKeys = staticKeys;
        } else {
            const loadedWritable = rpcTx.meta?.loadedAddresses?.writable || [];
            const loadedReadonly = rpcTx.meta?.loadedAddresses?.readonly || [];
            allAccountKeys = [...staticKeys, ...loadedWritable, ...loadedReadonly];
        }

        // 处理 instructions：V0 使用 compiledInstructions，legacy 使用 instructions
        const rawInstructions = message.compiledInstructions || message.instructions || [];
        const convertedInstructions = rawInstructions.map((ix: any) => {
            if (ix.accountKeyIndexes !== undefined) {
                return {
                    programIdIndex: ix.programIdIndex,
                    accounts: this.bufferOrArrayToBufferFormat(ix.accountKeyIndexes),
                    data: this.bufferOrBase58ToBufferFormat(ix.data),
                };
            } else {
                return {
                    programIdIndex: ix.programIdIndex,
                    accounts: this.numberArrayToBufferFormat(ix.accounts || []),
                    data: this.base58ToBufferFormat(ix.data),
                };
            }
        });

        return {
            signature: this.base58ToBufferFormat(rpcTx.signature),
            isVote,
            transaction: {
                signatures: txData.signatures.map((sig: string) => this.base58ToBufferFormat(sig)),
                message: {
                    header: message.header,
                    accountKeys: allAccountKeys.map((key: string) => this.base58ToBufferFormat(key)),
                    recentBlockhash: this.base58ToBufferFormat(message.recentBlockhash),
                    instructions: convertedInstructions,
                    versioned: rpcTx.transaction.version !== 'legacy',
                    addressTableLookups: (message.addressTableLookups || []).map((lookup: any) => ({
                        accountKey: this.base58ToBufferFormat(lookup.accountKey),
                        writableIndexes: this.numberArrayToBufferFormat(lookup.writableIndexes || []),
                        readonlyIndexes: this.numberArrayToBufferFormat(lookup.readonlyIndexes || []),
                    })),
                },
            },
            meta: rpcTx.meta ? {
                err: rpcTx.meta.err ? {
                    err: Buffer.from(JSON.stringify(rpcTx.meta.err))
                } : undefined,
                fee: String(rpcTx.meta.fee),
                preBalances: (rpcTx.meta.preBalances || []).map((b: number) => String(b)),
                postBalances: (rpcTx.meta.postBalances || []).map((b: number) => String(b)),
                innerInstructions: (rpcTx.meta.innerInstructions || []).map((inner: any) => ({
                    index: inner.index,
                    instructions: (inner.instructions || []).map((ix: any) => ({
                        programIdIndex: ix.programIdIndex,
                        accounts: this.numberArrayToBufferFormat(ix.accounts || []),
                        data: this.base58ToBufferFormat(ix.data),
                        stackHeight: ix.stackHeight,
                    })),
                })),
                innerInstructionsNone: !rpcTx.meta.innerInstructions || rpcTx.meta.innerInstructions.length === 0,
                logMessages: rpcTx.meta.logMessages || [],
                logMessagesNone: !rpcTx.meta.logMessages || rpcTx.meta.logMessages.length === 0,
                preTokenBalances: (rpcTx.meta.preTokenBalances || []).map((tb: any) => ({
                    accountIndex: tb.accountIndex,
                    mint: tb.mint,
                    uiTokenAmount: tb.uiTokenAmount,
                    owner: tb.owner || '',
                    programId: tb.programId || '',
                })),
                postTokenBalances: (rpcTx.meta.postTokenBalances || []).map((tb: any) => ({
                    accountIndex: tb.accountIndex,
                    mint: tb.mint,
                    uiTokenAmount: tb.uiTokenAmount,
                    owner: tb.owner || '',
                    programId: tb.programId || '',
                })),
                rewards: [],
                loadedWritableAddresses: (rpcTx.meta.loadedAddresses?.writable || []).map((addr: string) =>
                    this.base58ToBufferFormat(addr)
                ),
                loadedReadonlyAddresses: (rpcTx.meta.loadedAddresses?.readonly || []).map((addr: string) =>
                    this.base58ToBufferFormat(addr)
                ),
                returnData: rpcTx.meta.returnData ? {
                    programId: this.base58ToBufferFormat(rpcTx.meta.returnData.programId),
                    data: this.base64ToBufferFormat(rpcTx.meta.returnData.data[0]),
                } : undefined,
                returnDataNone: !rpcTx.meta.returnData,
                computeUnitsConsumed: rpcTx.meta.computeUnitsConsumed !== undefined
                    ? String(rpcTx.meta.computeUnitsConsumed)
                    : undefined,
            } : undefined,
            index: String(rpcTx.index),
        };
    }

    private static isVoteTransaction(tx: any): boolean {
        const VOTE_PROGRAM_ID = 'Vote111111111111111111111111111111111111111';
        try {
            const accountKeys = tx.transaction?.transaction?.message?.staticAccountKeys ||
                              tx.transaction?.transaction?.message?.accountKeys || [];
            const instructions = tx.transaction?.transaction?.message?.compiledInstructions ||
                               tx.transaction?.transaction?.message?.instructions || [];

            for (const ix of instructions) {
                const programId = accountKeys[ix.programIdIndex];
                if (programId === VOTE_PROGRAM_ID) {
                    return true;
                }
            }
        } catch (e) {
            // ignore
        }
        return false;
    }

    private static base58ToBufferFormat(base58Str: string): Uint8Array {
        return base58.decode(base58Str);
    }

    private static base64ToBufferFormat(base64Str: string): Uint8Array {
        return Buffer.from(base64Str, 'base64');
    }

    private static numberArrayToBufferFormat(numbers: number[]): Uint8Array {
        return new Uint8Array(numbers);
    }

    private static bufferOrArrayToBufferFormat(data: any): Uint8Array {
        if (Array.isArray(data)) {
            return new Uint8Array(data);
        }
        if (data && data.type === 'Buffer') {
            return new Uint8Array(data.data);
        }
        if (data instanceof Uint8Array || data instanceof Buffer) {
            return new Uint8Array(data);
        }
        return new Uint8Array([]);
    }

    private static bufferOrBase58ToBufferFormat(data: any): Uint8Array {
        if (data && data.type === 'Buffer') {
            return new Uint8Array(data.data);
        }
        if (typeof data === 'string') {
            return this.base58ToBufferFormat(data);
        }
        if (Array.isArray(data)) {
            return new Uint8Array(data);
        }
        if (data instanceof Uint8Array || data instanceof Buffer) {
            return new Uint8Array(data);
        }
        return new Uint8Array([]);
    }
}

