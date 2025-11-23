import { commonQuery, commonInsert, commonUpdate, commonDelete } from "../../utils/mysqlHelper";
import { SnapShotForWalletTrading } from "../../type/transaction";

// 批量插入配置
const BATCH_INSERT_CONFIG = {
    // MySQL占位符限制通常是65535，每条记录13个字段
    // 安全起见设置为1000条/批 (1000 * 13 = 13000 << 65535)
    BATCH_SIZE: 1000,
    FIELDS_PER_RECORD: 13,
    // 批次间延迟(毫秒)，避免数据库压力过大
    BATCH_DELAY_MS: 10
} as const;

/**
 * 计算并验证批次大小，确保不超过MySQL占位符限制
 */
function calculateOptimalBatchSize(recordCount: number, fieldsPerRecord: number = BATCH_INSERT_CONFIG.FIELDS_PER_RECORD): {
    recommendedBatchSize: number;
    totalBatches: number;
    maxPlaceholdersPerBatch: number;
    isSafe: boolean;
} {
    const MAX_MYSQL_PLACEHOLDERS = 65535;
    const SAFETY_MARGIN = 0.8; // 使用80%的限制作为安全边界
    const SAFE_LIMIT = Math.floor(MAX_MYSQL_PLACEHOLDERS * SAFETY_MARGIN);
    
    const maxRecordsPerBatch = Math.floor(SAFE_LIMIT / fieldsPerRecord);
    const recommendedBatchSize = Math.min(BATCH_INSERT_CONFIG.BATCH_SIZE, maxRecordsPerBatch);
    const totalBatches = Math.ceil(recordCount / recommendedBatchSize);
    const maxPlaceholdersPerBatch = recommendedBatchSize * fieldsPerRecord;
    const isSafe = maxPlaceholdersPerBatch <= SAFE_LIMIT;

    return {
        recommendedBatchSize,
        totalBatches,
        maxPlaceholdersPerBatch,
        isSafe
    };
}

// 数据库表字段接口（snake_case）
export interface WalletTradingSnapshotDB {
    id?: number;
    wallet_address: string;
    snapshot_time: string; // DATETIME 格式
    per_tl_trading_value: string; // JSON 字符串
    total_buy_sol_amount: number;
    total_buy_usd_amount: number;
    total_sell_sol_amount: number;
    total_sell_usd_amount: number;
    buy_count: number;
    sell_count: number;
    sol_price: number;
    win_count: number;
    lose_count: number;
    current_token_value: string; // JSON 字符串
    created_at?: string;
    updated_at?: string;
}

/**
 * 将 SnapShotForWalletTrading 转换为数据库格式
 */
function walletTradingSnapShotToDb(snapshot: SnapShotForWalletTrading): Omit<WalletTradingSnapshotDB, 'id' | 'created_at' | 'updated_at'> {
    // 验证时间值的有效性
    let validSnapshotTime: string;
    try {
        // 检查 snapshotTime 是否为有效值
        if (!snapshot.snapshotTime || snapshot.snapshotTime.trim() === '') {
            console.warn(`Invalid snapshotTime (empty or null): "${snapshot.snapshotTime}", using current time`);
            validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        } else {
            // 检查是否是Unix时间戳（数字字符串）
            const timestampStr = snapshot.snapshotTime.trim();
            const timestampNum = parseInt(timestampStr);

            if (!isNaN(timestampNum) && timestampStr === timestampNum.toString()) {
                // 这是一个Unix时间戳
                let date;
                if (timestampNum > 1e12) {
                    // 毫秒时间戳 (13位数字)
                    date = new Date(timestampNum);
                } else {
                    // 秒时间戳 (10位数字)
                    date = new Date(timestampNum * 1000);
                }

                if (isNaN(date.getTime())) {
                    console.warn(`Invalid Unix timestamp: "${snapshot.snapshotTime}", using current time`);
                    validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
                } else {
                    validSnapshotTime = date.toISOString().slice(0, 19).replace('T', ' ');
                }
            } else {
                // 尝试创建 Date 对象验证时间格式
                const date = new Date(snapshot.snapshotTime);
                if (isNaN(date.getTime())) {
                    console.warn(`Invalid snapshotTime format: "${snapshot.snapshotTime}", using current time`);
                    validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
                } else {
                    validSnapshotTime = date.toISOString().slice(0, 19).replace('T', ' ');
                }
            }
        }
    } catch (error) {
        console.error(`Error processing snapshotTime "${snapshot.snapshotTime}":`, error);
        console.log('Using current time as fallback');
        validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    // 数值安全检查函数
    const safeNumber = (value: number, fallback: number = 0, fieldName: string = 'unknown'): number => {
        if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
            console.warn(`⚠️  无效数值在字段 ${fieldName}: ${value}, 使用默认值: ${fallback}`);
            console.warn(`   钱包地址: ${snapshot.walletAddress}`);
            return fallback;
        }
        return value;
    };

    return {
        wallet_address: snapshot.walletAddress,
        snapshot_time: validSnapshotTime,
        per_tl_trading_value: JSON.stringify(snapshot.perTLTradingValue),
        total_buy_sol_amount: safeNumber(snapshot.totalBuySolAmount, 0, 'totalBuySolAmount'),
        total_buy_usd_amount: safeNumber(snapshot.totalBuyUsdAmount, 0, 'totalBuyUsdAmount'),
        total_sell_sol_amount: safeNumber(snapshot.totalSellSolAmount, 0, 'totalSellSolAmount'),
        total_sell_usd_amount: safeNumber(snapshot.totalSellUsdAmount, 0, 'totalSellUsdAmount'),
        buy_count: safeNumber(snapshot.buy_count, 0, 'buy_count'),
        sell_count: safeNumber(snapshot.sell_count, 0, 'sell_count'),
        sol_price: safeNumber(snapshot.solPrice, 0, 'solPrice'),
        win_count: safeNumber(snapshot.winCount, 0, 'winCount'),
        lose_count: safeNumber(snapshot.loseCount, 0, 'loseCount'),
        current_token_value: JSON.stringify(snapshot.currentTokenValue)
    };
}

/**
 * 将数据库格式转换为 SnapShotForWalletTrading
 */
function dbToWalletTradingSnapShot(dbRecord: WalletTradingSnapshotDB): SnapShotForWalletTrading {
    return {
        walletAddress: dbRecord.wallet_address,
        snapshotTime: new Date(dbRecord.snapshot_time).toISOString(),
        perTLTradingValue: JSON.parse(dbRecord.per_tl_trading_value),
        totalBuySolAmount: dbRecord.total_buy_sol_amount,
        totalBuyUsdAmount: dbRecord.total_buy_usd_amount,
        totalSellSolAmount: dbRecord.total_sell_sol_amount,
        totalSellUsdAmount: dbRecord.total_sell_usd_amount,
        buy_count: dbRecord.buy_count,
        sell_count: dbRecord.sell_count,
        solPrice: dbRecord.sol_price,
        winCount: dbRecord.win_count,
        loseCount: dbRecord.lose_count,
        currentTokenValue: JSON.parse(dbRecord.current_token_value)
    };
}

/**
 * 创建新的钱包交易快照记录
 */
export async function createWalletTradingSnapshot(snapshot: SnapShotForWalletTrading): Promise<SnapShotForWalletTrading | null> {
    const dbData = walletTradingSnapShotToDb(snapshot);
    const insertSql = `
        INSERT INTO wallet_trading_ss (
            wallet_address, snapshot_time, per_tl_trading_value, total_buy_sol_amount,
            total_buy_usd_amount, total_sell_sol_amount, total_sell_usd_amount,
            buy_count, sell_count, sol_price, win_count, lose_count, current_token_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const result = await commonInsert(insertSql, [
            dbData.wallet_address,
            dbData.snapshot_time,
            dbData.per_tl_trading_value,
            dbData.total_buy_sol_amount,
            dbData.total_buy_usd_amount,
            dbData.total_sell_sol_amount,
            dbData.total_sell_usd_amount,
            dbData.buy_count,
            dbData.sell_count,
            dbData.sol_price,
            dbData.win_count,
            dbData.lose_count,
            dbData.current_token_value
        ]);

        if (result.insertId) {
            return await getWalletTradingSnapshotById(result.insertId);
        }
    } catch (error) {
        console.error("Error creating wallet trading snapshot:", error);
    }
    return null;
}

/**
 * 批量创建钱包交易快照记录
 */
export async function batchCreateWalletTradingSnapshots(snapshots: SnapShotForWalletTrading[]): Promise<number> {
    if (snapshots.length === 0) return 0;

    // 计算最优批次大小，确保不超过MySQL占位符限制
    const batchInfo = calculateOptimalBatchSize(snapshots.length);
    
    if (!batchInfo.isSafe) {
        console.warn(`⚠️  警告: 计算的批次大小可能不安全! 占位符数量: ${batchInfo.maxPlaceholdersPerBatch}`);
    }
    
    let totalInserted = 0;
    let batchNumber = 1;
    
    console.log(`🔍 开始分批验证和插入 ${snapshots.length} 个快照数据...`);
    console.log(`📊 优化后的批次配置:`);
    console.log(`   - 批次大小: ${batchInfo.recommendedBatchSize} 条/批`);
    console.log(`   - 总批次数: ${batchInfo.totalBatches}`);
    console.log(`   - 每批占位符: ${batchInfo.maxPlaceholdersPerBatch} (安全限制: 52428)`);
    console.log(`   - 安全状态: ${batchInfo.isSafe ? '✅ 安全' : '❌ 可能超限'}`);

    try {
        // 分批处理
        for (let i = 0; i < snapshots.length; i += batchInfo.recommendedBatchSize) {
            const batchSnapshots = snapshots.slice(i, i + batchInfo.recommendedBatchSize);
            const actualBatchSize = batchSnapshots.length;
            const totalPlaceholders = actualBatchSize * BATCH_INSERT_CONFIG.FIELDS_PER_RECORD;
            
            console.log(`\n🔄 处理批次 ${batchNumber}/${batchInfo.totalBatches}`);
            console.log(`   📝 批次大小: ${actualBatchSize} 条`);
            console.log(`   🎯 占位符数量: ${totalPlaceholders}`);

            const batchResult = await processBatch(batchSnapshots, batchNumber);
            totalInserted += batchResult;
            
            console.log(`✅ 批次 ${batchNumber} 完成: 插入 ${batchResult} 条记录`);
            batchNumber++;
            
            // 避免过于频繁的数据库操作，每批之间稍作延迟
            if (batchNumber <= batchInfo.totalBatches) {
                await new Promise(resolve => setTimeout(resolve, BATCH_INSERT_CONFIG.BATCH_DELAY_MS));
            }
        }

        console.log(`\n🎉 所有批次处理完成! 总共插入 ${totalInserted} 条记录`);
        return totalInserted;

    } catch (error: unknown) {
        console.error("\n❌ 批量创建钱包交易快照失败:");
        console.error("   错误信息:", error instanceof Error ? error.message : String(error));
        console.error("   完整错误:", error);

        // 如果是占位符相关错误，提供更多上下文
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('too many placeholders') || errorMessage.includes('Prepared statement')) {
            console.error("🔍 这是一个占位符数量超限问题，请检查批次大小设置");
            console.error(`💡 建议: 减少 BATCH_SIZE 从 ${BATCH_INSERT_CONFIG.BATCH_SIZE} 到更小的值`);
        }

        return totalInserted; // 返回已成功插入的数量
    }
}

/**
 * 处理单个批次的插入操作
 */
async function processBatch(batchSnapshots: SnapShotForWalletTrading[], batchNumber: number): Promise<number> {
    const values = batchSnapshots.map(() =>
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).join(', ');

    const sql = `
        INSERT INTO wallet_trading_ss (
            wallet_address, snapshot_time, per_tl_trading_value, total_buy_sol_amount,
            total_buy_usd_amount, total_sell_sol_amount, total_sell_usd_amount,
            buy_count, sell_count, sol_price, win_count, lose_count, current_token_value
        ) VALUES ${values}
    `;

    const params: any[] = [];

    // 验证和转换数据
    batchSnapshots.forEach((snapshot, index) => {
        try {
            const dbData = walletTradingSnapShotToDb(snapshot);

            // 验证所有数字字段是否为 NaN
            const numericFields = {
                total_buy_sol_amount: dbData.total_buy_sol_amount,
                total_buy_usd_amount: dbData.total_buy_usd_amount,
                total_sell_sol_amount: dbData.total_sell_sol_amount,
                total_sell_usd_amount: dbData.total_sell_usd_amount,
                buy_count: dbData.buy_count,
                sell_count: dbData.sell_count,
                sol_price: dbData.sol_price,
                win_count: dbData.win_count,
                lose_count: dbData.lose_count
            };

            // 检查每个数字字段
            for (const [fieldName, value] of Object.entries(numericFields)) {
                if (isNaN(value) || !isFinite(value)) {
                    console.error(`❌ 批次 ${batchNumber} 发现无效数据在快照 ${index}:`);
                    console.error(`   钱包地址: ${snapshot.walletAddress}`);
                    console.error(`   字段: ${fieldName}`);
                    console.error(`   无效值: ${value}`);
                    throw new Error(`Invalid numeric value in field ${fieldName}: ${value}`);
                }
            }

            // 检查 JSON 字段
            try {
                JSON.parse(dbData.per_tl_trading_value);
                JSON.parse(dbData.current_token_value);
            } catch (jsonError) {
                console.error(`❌ 批次 ${batchNumber} JSON 字段解析错误在快照 ${index}:`);
                console.error(`   钱包地址: ${snapshot.walletAddress}`);
                console.error(`   JSON 错误:`, jsonError);
                throw jsonError;
            }

            // 如果验证通过，添加到参数数组
            params.push(
                dbData.wallet_address,
                dbData.snapshot_time,
                dbData.per_tl_trading_value,
                dbData.total_buy_sol_amount,
                dbData.total_buy_usd_amount,
                dbData.total_sell_sol_amount,
                dbData.total_sell_usd_amount,
                dbData.buy_count,
                dbData.sell_count,
                dbData.sol_price,
                dbData.win_count,
                dbData.lose_count,
                dbData.current_token_value
            );

        } catch (conversionError) {
            console.error(`❌ 批次 ${batchNumber} 数据转换错误在快照 ${index}:`, conversionError);
            console.error(`   原始快照数据:`, JSON.stringify(snapshot, null, 2));
            throw conversionError;
        }
    });

    // 执行批次插入
    const result = await commonInsert(sql, params);
    return result.affectedRows;
}

/**
 * 根据 ID 获取钱包交易快照
 */
export async function getWalletTradingSnapshotById(id: number): Promise<SnapShotForWalletTrading | null> {
    try {
        const sql = `
            SELECT * FROM wallet_trading_ss WHERE id = ?
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [id]);
        if (result[0]) {
            return dbToWalletTradingSnapShot(result[0]);
        }
    } catch (error) {
        console.error("Error getting wallet trading snapshot by id:", error);
    }
    return null;
}

/**
 * 根据钱包地址获取快照列表
 */
export async function getWalletTradingSnapshotsByAddress(
    walletAddress: string,
    page: number = 1,
    pageSize: number = 50
): Promise<SnapShotForWalletTrading[]> {
    try {
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE wallet_address = ?
            ORDER BY snapshot_time DESC, id DESC
            LIMIT ? OFFSET ?
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [walletAddress, pageSize, offset]);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallet trading snapshots by address:", error);
        return [];
    }
}

/**
 * 根据时间范围获取快照
 */
export async function getWalletTradingSnapshotsByTimeRange(
    startTime: string,
    endTime: string,
    walletAddress?: string
): Promise<SnapShotForWalletTrading[]> {
    try {
        let sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE snapshot_time >= ? AND snapshot_time <= ?
        `;
        const params: any[] = [startTime, endTime];

        if (walletAddress) {
            sql += ` AND wallet_address = ?`;
            params.push(walletAddress);
        }

        sql += ` ORDER BY snapshot_time DESC, id DESC`;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, params);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallet trading snapshots by time range:", error);
        return [];
    }
}

/**
 * 获取指定钱包的最新快照
 */
export async function getLatestWalletTradingSnapshot(walletAddress: string): Promise<SnapShotForWalletTrading | null> {
    try {
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE wallet_address = ?
            ORDER BY snapshot_time DESC, id DESC
            LIMIT 1
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [walletAddress]);
        if (result[0]) {
            return dbToWalletTradingSnapShot(result[0]);
        }
    } catch (error) {
        console.error("Error getting latest wallet trading snapshot:", error);
    }
    return null;
}

/**
 * 获取指定钱包在指定时间之前的最后一次快照
 */

export async function getLatestWalletTradingSnapshotBeforeTime(walletAddress: string, timestamp: number): Promise<SnapShotForWalletTrading | null> {
    try {
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE wallet_address = ? AND snapshot_time < ?
            ORDER BY snapshot_time DESC, id DESC
            LIMIT 1
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [walletAddress, timestamp]);
        if (result[0]) {
            return dbToWalletTradingSnapShot(result[0]);
        }
    } catch (error) {
        console.error("Error getting latest wallet trading snapshot before time:", error);
    }
    return null;
}

/**
 * 根据盈亏情况获取钱包列表
 */
export async function getWalletsByProfitLoss(
    minWinCount?: number,
    minLoseCount?: number,
    minPnlUsd?: number,
    page: number = 1,
    pageSize: number = 50
): Promise<SnapShotForWalletTrading[]> {
    try {
        const offset = (page - 1) * pageSize;
        let sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE 1=1
        `;
        const params: any[] = [];

        if (minWinCount !== undefined) {
            sql += ` AND win_count >= ?`;
            params.push(minWinCount);
        }

        if (minLoseCount !== undefined) {
            sql += ` AND lose_count >= ?`;
            params.push(minLoseCount);
        }

        if (minPnlUsd !== undefined) {
            sql += ` AND (total_sell_usd_amount - total_buy_usd_amount) >= ?`;
            params.push(minPnlUsd);
        }

        sql += ` ORDER BY (total_sell_usd_amount - total_buy_usd_amount) DESC LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, params);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallets by profit loss:", error);
        return [];
    }
}

/**
 * 查询持有特定代币的钱包
 */
export async function getWalletsHoldingToken(
    tokenAddress: string,
    page: number = 1,
    pageSize: number = 50
): Promise<SnapShotForWalletTrading[]> {
    try {
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE JSON_CONTAINS(current_token_value, JSON_OBJECT('tokenAddress', ?))
            ORDER BY snapshot_time DESC
            LIMIT ? OFFSET ?
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [tokenAddress, pageSize, offset]);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallets holding token:", error);
        return [];
    }
}

/**
 * 查询交易过特定代币的钱包
 */
export async function getWalletsTradedToken(
    tokenAddress: string,
    page: number = 1,
    pageSize: number = 50
): Promise<SnapShotForWalletTrading[]> {
    try {
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE JSON_CONTAINS(per_tl_trading_value, JSON_OBJECT('tokenAddress', ?))
            ORDER BY snapshot_time DESC
            LIMIT ? OFFSET ?
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [tokenAddress, pageSize, offset]);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallets traded token:", error);
        return [];
    }
}

/**
 * 更新钱包交易快照
 */
export async function updateWalletTradingSnapshot(id: number, updateData: Partial<SnapShotForWalletTrading>): Promise<boolean> {
    try {
        const setClauses: string[] = [];
        const params: any[] = [];

        if (updateData.walletAddress !== undefined) {
            setClauses.push('wallet_address = ?');
            params.push(updateData.walletAddress);
        }
        if (updateData.snapshotTime !== undefined) {
            // 验证时间值的有效性
            let validSnapshotTime: string;
            try {
                if (!updateData.snapshotTime || updateData.snapshotTime.trim() === '') {
                    console.warn(`Invalid snapshotTime in update (empty or null): "${updateData.snapshotTime}", using current time`);
                    validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
                } else {
                    const date = new Date(updateData.snapshotTime);
                    if (isNaN(date.getTime())) {
                        console.warn(`Invalid snapshotTime format in update: "${updateData.snapshotTime}", using current time`);
                        validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    } else {
                        validSnapshotTime = date.toISOString().slice(0, 19).replace('T', ' ');
                    }
                }
            } catch (error) {
                console.error(`Error processing snapshotTime in update "${updateData.snapshotTime}":`, error);
                console.log('Using current time as fallback');
                validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
            }

            setClauses.push('snapshot_time = ?');
            params.push(validSnapshotTime);
        }
        if (updateData.perTLTradingValue !== undefined) {
            setClauses.push('per_tl_trading_value = ?');
            params.push(JSON.stringify(updateData.perTLTradingValue));
        }
        if (updateData.totalBuySolAmount !== undefined) {
            setClauses.push('total_buy_sol_amount = ?');
            params.push(updateData.totalBuySolAmount);
        }
        if (updateData.totalBuyUsdAmount !== undefined) {
            setClauses.push('total_buy_usd_amount = ?');
            params.push(updateData.totalBuyUsdAmount);
        }
        if (updateData.totalSellSolAmount !== undefined) {
            setClauses.push('total_sell_sol_amount = ?');
            params.push(updateData.totalSellSolAmount);
        }
        if (updateData.totalSellUsdAmount !== undefined) {
            setClauses.push('total_sell_usd_amount = ?');
            params.push(updateData.totalSellUsdAmount);
        }
        if (updateData.buy_count !== undefined) {
            setClauses.push('buy_count = ?');
            params.push(updateData.buy_count);
        }
        if (updateData.sell_count !== undefined) {
            setClauses.push('sell_count = ?');
            params.push(updateData.sell_count);
        }
        if (updateData.solPrice !== undefined) {
            setClauses.push('sol_price = ?');
            params.push(updateData.solPrice);
        }
        if (updateData.winCount !== undefined) {
            setClauses.push('win_count = ?');
            params.push(updateData.winCount);
        }
        if (updateData.loseCount !== undefined) {
            setClauses.push('lose_count = ?');
            params.push(updateData.loseCount);
        }
        if (updateData.currentTokenValue !== undefined) {
            setClauses.push('current_token_value = ?');
            params.push(JSON.stringify(updateData.currentTokenValue));
        }

        if (setClauses.length === 0) {
            return false;
        }

        params.push(id);
        const sql = `
            UPDATE wallet_trading_ss 
            SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const affectedRows = await commonUpdate(sql, params);
        return affectedRows > 0;
    } catch (error) {
        console.error("Error updating wallet trading snapshot:", error);
        return false;
    }
}

/**
 * 删除钱包交易快照
 */
export async function deleteWalletTradingSnapshot(id: number): Promise<boolean> {
    try {
        const sql = `DELETE FROM wallet_trading_ss WHERE id = ?`;
        const affectedRows = await commonDelete(sql, [id]);
        return affectedRows > 0;
    } catch (error) {
        console.error("Error deleting wallet trading snapshot:", error);
        return false;
    }
}

/**
 * 删除指定钱包地址的所有快照
 */
export async function deleteWalletTradingSnapshotsByAddress(walletAddress: string): Promise<number> {
    try {
        const sql = `DELETE FROM wallet_trading_ss WHERE wallet_address = ?`;
        const affectedRows = await commonDelete(sql, [walletAddress]);
        return affectedRows;
    } catch (error) {
        console.error("Error deleting wallet trading snapshots by address:", error);
        return 0;
    }
}

/**
 * 获取钱包交易快照总数
 */
export async function getWalletTradingSnapshotCount(walletAddress?: string): Promise<number> {
    try {
        let sql = `SELECT COUNT(*) as count FROM wallet_trading_ss`;
        const params: any[] = [];

        if (walletAddress) {
            sql += ` WHERE wallet_address = ?`;
            params.push(walletAddress);
        }

        const result = await commonQuery<{ count: number }>(sql, params);
        return result[0]?.count || 0;
    } catch (error) {
        console.error("Error getting wallet trading snapshot count:", error);
        return 0;
    }
}

/**
 * 获取钱包交易统计信息
 */
export async function getWalletTradingStats(walletAddress?: string): Promise<{
    totalWallets: number;
    totalPnlUsd: number;
    avgWinCount: number;
    avgLoseCount: number;
    totalBuyVolume: number;
    totalSellVolume: number;
} | null> {
    try {
        let sql = `
            SELECT 
                COUNT(DISTINCT wallet_address) as total_wallets,
                SUM(total_sell_usd_amount - total_buy_usd_amount) as total_pnl_usd,
                AVG(win_count) as avg_win_count,
                AVG(lose_count) as avg_lose_count,
                SUM(total_buy_usd_amount) as total_buy_volume,
                SUM(total_sell_usd_amount) as total_sell_volume
            FROM wallet_trading_ss
        `;
        const params: any[] = [];

        if (walletAddress) {
            sql += ` WHERE wallet_address = ?`;
            params.push(walletAddress);
        }

        const result = await commonQuery<{
            total_wallets: number;
            total_pnl_usd: number;
            avg_win_count: number;
            avg_lose_count: number;
            total_buy_volume: number;
            total_sell_volume: number;
        }>(sql, params);

        if (result[0]) {
            return {
                totalWallets: result[0].total_wallets,
                totalPnlUsd: result[0].total_pnl_usd,
                avgWinCount: result[0].avg_win_count,
                avgLoseCount: result[0].avg_lose_count,
                totalBuyVolume: result[0].total_buy_volume,
                totalSellVolume: result[0].total_sell_volume
            };
        }
    } catch (error) {
        console.error("Error getting wallet trading stats:", error);
    }
    return null;
}

/**
 * 保存钱包交易快照数据到数据库
 */
export async function saveWalletTradingSnapshots(snapshots: SnapShotForWalletTrading[]): Promise<boolean> {
    try {
        const insertedCount = await batchCreateWalletTradingSnapshots(snapshots);
        console.log(`Successfully saved ${insertedCount} wallet trading snapshots to database`);
        return insertedCount > 0;
    } catch (error) {
        console.error("Error saving wallet trading snapshots:", error);
        return false;
    }
}

/**
 * 批量获取指定钱包在指定时间之前的最后一次快照
 */
export async function batchGetLatestWalletTradingSnapshotBeforeTime(
    walletAddresses: string[],
    timestamp: number
): Promise<Map<string, SnapShotForWalletTrading>> {
    const result = new Map<string, SnapShotForWalletTrading>();

    if (walletAddresses.length === 0) {
        return result;
    }

    try {
        // 构建IN查询的占位符
        const placeholders = walletAddresses.map(() => '?').join(',');

        const sql = `
            SELECT w1.* FROM wallet_trading_ss w1
            INNER JOIN (
                SELECT wallet_address, MAX(snapshot_time) as max_time
                FROM wallet_trading_ss 
                WHERE wallet_address IN (${placeholders}) 
                  AND snapshot_time < ?
                GROUP BY wallet_address
            ) w2 ON w1.wallet_address = w2.wallet_address 
                 AND w1.snapshot_time = w2.max_time
            ORDER BY w1.wallet_address, w1.id DESC
        `;

        const params = [...walletAddresses, timestamp];
        const queryResult = await commonQuery<WalletTradingSnapshotDB>(sql, params);

        // 将结果转换为Map，处理同一钱包多条记录的情况（取最新的一条）
        const processedWallets = new Set<string>();
        for (const row of queryResult) {
            if (!processedWallets.has(row.wallet_address)) {
                const snapshot = dbToWalletTradingSnapShot(row);
                result.set(row.wallet_address, snapshot);
                processedWallets.add(row.wallet_address);
            }
        }

        console.log(`📊 批量查询 ${walletAddresses.length} 个钱包，找到 ${result.size} 个历史快照`);

    } catch (error) {
        console.error("Error batch getting latest wallet trading snapshots before time:", error);
    }

    return result;
}
