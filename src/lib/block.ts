import { Connection, MessageAccountKeys } from "@solana/web3.js";
import solana_connect_instance from "./solana";
import { TransactionInfo } from "../type/transaction";

export const getBlockHashBySlotNumber = async (connection: Connection, slot: number) => {
    const blockhash = await connection.getBlockSignatures(slot);
    return blockhash;
}


export const getTransactionBySignature = async (signature: string) => {
    const connection = solana_connect_instance.getConnection();
    const transaction = await connection.getTransaction(signature, {
        commitment: "confirmed"
    });
    return transaction;
}

// 获取指定区块中的所有交易
export async function getBlockTransactions(slot: number): Promise<TransactionInfo | null> {
    const connection = solana_connect_instance.getConnection();

    try {
        console.log(`开始获取区块 ${slot} 中的所有交易...`);

        // 获取区块信息，包含所有交易
        const block = await connection.getBlock(slot, {
            maxSupportedTransactionVersion: 0,
            transactionDetails: "full",
            rewards: false
        });

        if (!block) {
            console.warn(`区块 ${slot} 不存在或无法访问`);
            return null;
        }

        console.log(`区块 ${slot} 包含 ${block.transactions.length} 个交易`);

        // 返回区块信息和交易列表
        return {
            slot: slot, // 使用传入的slot参数
            blockTime: block.blockTime,
            blockHash: block.blockhash,
            parentSlot: block.parentSlot,
            transactionCount: block.transactions.length,
            transactions: block.transactions.map((tx, index) => ({
                index,
                signature: tx.transaction.signatures[0],
                transaction: tx,
                meta: tx.meta
            }))
        };

    } catch (error) {
        console.error(`获取区块 ${slot} 交易失败:`, error);
        throw error;
    }
}

// 获取区块中特定协议的交易
export async function getBlockTransactionsByProtocol(slot: number, programId: string) {

    try {
        console.log(`开始获取区块 ${slot} 中协议 ${programId} 的交易...`);

        const blockData = await getBlockTransactions(slot);
        if (!blockData) {
            return null;
        }

        // 过滤出与指定程序ID相关的交易
        const protocolTransactions = blockData.transactions.filter(tx => {
            // 检查交易是否涉及指定的程序ID
            const message = tx.transaction.transaction.message;
            // 使用getAccountKeys方法获取账户密钥

            let accountKeys: MessageAccountKeys = {} as MessageAccountKeys;
            try {
                accountKeys = message.getAccountKeys ?
                    message.getAccountKeys() : accountKeys;
            } catch (error) {
                console.log("git message", error, tx.transaction.transaction.signatures);
                return false
            }

            if (accountKeys.length === 0) {
                return false;
            } else {

                // 检查是否为MessageAccountKeys类型
                if ('get' in accountKeys) {
                    // 使用MessageAccountKeys的get方法
                    for (let i = 0; i < accountKeys.length; i++) {
                        try {
                            const key = accountKeys.get(i);
                            if (key && key.toString() === programId) {
                                return true;
                            }
                        } catch (error) {
                            console.log("git key", error, tx.transaction.transaction.signatures);
                            return false
                        }
                    }
                    return false;
                } else {
                    // 处理数组类型
                    return (accountKeys as any[]).some((key: any) => {
                        const keyStr = key.pubkey ? key.pubkey.toString() : key.toString();
                        return keyStr === programId;
                    });
                }
            }
        });

        console.log(`区块 ${slot} 中找到 ${protocolTransactions.length} 个与协议 ${programId} 相关的交易`);

        return {
            ...blockData,
            protocolTransactionCount: protocolTransactions.length,
            protocolTransactions
        };

    } catch (error) {
        console.error(`获取区块 ${slot} 协议交易失败:`, error);
        throw error;
    }
}

// 批量获取多个区块的交易
export async function getBatchBlockTransactions(slots: number[], maxConcurrent: number = 5) {
    console.log(`开始批量获取 ${slots.length} 个区块的交易...`);

    const results: Array<{
        slot: number;
        data: Awaited<ReturnType<typeof getBlockTransactions>> | null;
        error?: string;
    }> = [];

    // 分批处理，控制并发数量
    for (let i = 0; i < slots.length; i += maxConcurrent) {
        const batch = slots.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(async slot => {
            try {
                const data = await getBlockTransactions(slot);
                return { slot, data };
            } catch (error) {
                return {
                    slot,
                    data: null,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                results.push({
                    slot: 0, // 无法确定具体slot
                    data: null,
                    error: result.reason
                });
            }
        });

        console.log(`已处理 ${Math.min(i + maxConcurrent, slots.length)}/${slots.length} 个区块`);
    }

    const successCount = results.filter(r => r.data !== null).length;
    console.log(`批量获取完成，成功: ${successCount}/${slots.length}`);

    return results;
}

// 获取区块范围内的所有交易
export async function getBlockRangeTransactions(startSlot: number, endSlot: number, maxConcurrent: number = 3) {
    const slots = [];
    for (let slot = startSlot; slot <= endSlot; slot++) {
        slots.push(slot);
    }

    console.log(`开始获取区块范围 ${startSlot} - ${endSlot} 的所有交易，共 ${slots.length} 个区块`);

    return await getBatchBlockTransactions(slots, maxConcurrent);
}

// 获取区块中所有交易的基本统计信息
export async function getBlockTransactionStats(slot: number) {
    try {
        const blockData = await getBlockTransactions(slot);
        if (!blockData) {
            return null;
        }

        const stats = {
            slot: blockData.slot,
            blockTime: blockData.blockTime,
            totalTransactions: blockData.transactionCount,
            successfulTransactions: 0,
            failedTransactions: 0,
            uniqueSigners: new Set<string>(),
            totalFees: 0
        };

        blockData.transactions.forEach(tx => {
            // 统计成功和失败的交易
            if (tx.meta?.err) {
                stats.failedTransactions++;
            } else {
                stats.successfulTransactions++;
            }

            // 统计费用
            if (tx.meta?.fee) {
                stats.totalFees += tx.meta.fee;
            }

            // 统计唯一签名者
            if (tx.transaction.transaction.message.getAccountKeys) {
                const accountKeys = tx.transaction.transaction.message.getAccountKeys();
                if (accountKeys.length > 0) {
                    // 正确使用MessageAccountKeys的get方法
                    const firstAccount = accountKeys.get(0);
                    if (firstAccount) {
                        const signerKey = firstAccount.toString();
                        stats.uniqueSigners.add(signerKey);
                    }
                }
            }
        });

        return {
            ...stats,
            uniqueSignersCount: stats.uniqueSigners.size,
            successRate: (stats.successfulTransactions / (stats.totalTransactions || 0) * 100).toFixed(2) + '%'
        };

    } catch (error) {
        console.error(`获取区块 ${slot} 统计信息失败:`, error);
        throw error;
    }
}

// 检查区块是否存在
export async function checkBlockExists(slot: number): Promise<boolean> {
    const connection = solana_connect_instance.getConnection();
    try {
        const block = await connection.getBlock(slot, {
            maxSupportedTransactionVersion: 0,
            transactionDetails: "none",
            rewards: false
        });
        return block !== null;
    } catch (error) {
        return false;
    }
}

// 获取区块的基本信息（不包含交易详情）
export async function getBlockInfo(slot: number) {
    const connection = solana_connect_instance.getConnection();
    try {
        const block = await connection.getBlock(slot, {
            maxSupportedTransactionVersion: 0,
            transactionDetails: "signatures",
            rewards: false
        });

        if (!block) {
            return null;
        }

        return {
            slot: slot,
            blockTime: block.blockTime,
            blockHash: block.blockhash,
            parentSlot: block.parentSlot,
            transactionCount: block.transactions.length,
            signatures: block.transactions.map(tx => {
                // 当transactionDetails为"signatures"时，tx是string类型
                if (typeof tx === 'string') {
                    return tx;
                } else {
                    // 当有完整transaction对象时，获取第一个signature
                    return tx.transaction.signatures[0];
                }
            })
        };
    } catch (error) {
        console.error(`获取区块 ${slot} 基本信息失败:`, error);
        throw error;
    }
}

// 批量检查区块是否存在
export async function batchCheckBlocksExist(slots: number[], maxConcurrent: number = 10): Promise<{ [slot: number]: boolean }> {
    console.log(`开始批量检查 ${slots.length} 个区块是否存在...`);

    const results: { [slot: number]: boolean } = {};

    // 分批处理
    for (let i = 0; i < slots.length; i += maxConcurrent) {
        const batch = slots.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(async slot => {
            const exists = await checkBlockExists(slot);
            return { slot, exists };
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
                results[result.value.slot] = result.value.exists;
            } else {
                // 如果检查失败，默认认为不存在
                console.warn(`检查区块存在性失败:`, result.reason);
            }
        });

        console.log(`已检查 ${Math.min(i + maxConcurrent, slots.length)}/${slots.length} 个区块`);
    }

    const existingCount = Object.values(results).filter(exists => exists).length;
    console.log(`批量检查完成，存在: ${existingCount}/${slots.length}`);

    return results;
}



