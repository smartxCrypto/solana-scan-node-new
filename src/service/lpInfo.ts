import redisClient from "@/constant/config/redis";
import { commonQuery, commonInsert, commonDelete, commonQueryWithPagination } from "@/utils/mysqlHelper";

/**
 * LP信息接口 - 对应数据库表结构
 */
export interface LpInfo {
  id?: number;
  pool_address: string;
  token_a_mint: string;
  token_b_mint: string;
  token_a_symbol: string;
  token_b_symbol: string;
  token_a_amount: bigint;
  token_b_amount: bigint;
  liquidity_usd: bigint;
  fee_rate: number;
  created_timestamp: bigint;
  last_updated_timestamp: bigint;
  created_at?: string;
  updated_at?: string;
}

/**
 * 用于更新的LP信息接口
 */
export interface LpInfoUpdate {
  pool_address: string;
  token_a_mint: string;
  token_b_mint: string;
  token_a_symbol?: string;
  token_b_symbol?: string;
  token_a_amount: number;
  token_b_amount: number;
  liquidity_usd: number;
  fee_rate?: number;
  transactinTimeTs: number;
}

const lpInfoCache = "lp_info_cache";

/**
 * 1. 根据token地址查询所有和这个token有关的列表
 * @param tokenMint - token地址
 * @returns 包含该token的所有LP信息
 */
export async function getLpInfoByToken(tokenMint: string): Promise<LpInfo[]> {
  const sql = `
    SELECT id, pool_address, token_a_mint, token_b_mint, token_a_symbol, token_b_symbol,
           token_a_amount, token_b_amount, liquidity_usd, fee_rate, 
           created_timestamp, last_updated_timestamp, created_at, updated_at
    FROM lp_info
    WHERE token_a_mint = ? OR token_b_mint = ?
    ORDER BY liquidity_usd DESC, last_updated_timestamp DESC
  `;

  try {
    const result = await commonQuery<LpInfo>(sql, [tokenMint, tokenMint]);
    return result;
  } catch (error) {
    console.error(`Error in getLpInfoByToken for token ${tokenMint}:`, error);
    throw error;
  }
}

/**
 * 2. 根据两个token地址查询到这个代币交易对的信息
 * @param tokenA - 第一个token地址
 * @param tokenB - 第二个token地址
 * @returns 匹配的LP信息
 */
export async function getLpInfoByTokenPair(
  tokenA: string,
  tokenB: string
): Promise<LpInfo[]> {
  const sql = `
    SELECT id, pool_address, token_a_mint, token_b_mint, token_a_symbol, token_b_symbol,
           token_a_amount, token_b_amount, liquidity_usd, fee_rate,
           created_timestamp, last_updated_timestamp, created_at, updated_at
    FROM lp_info
    WHERE (token_a_mint = ? AND token_b_mint = ?) OR (token_a_mint = ? AND token_b_mint = ?)
    ORDER BY liquidity_usd DESC, last_updated_timestamp DESC
  `;

  try {
    const result = await commonQuery<LpInfo>(sql, [tokenA, tokenB, tokenB, tokenA]);
    return result;
  } catch (error) {
    console.error(`Error in getLpInfoByTokenPair for ${tokenA}-${tokenB}:`, error);
    throw error;
  }
}

/**
 * 根据池地址查询LP信息（带缓存）
 * @param poolAddress - 池地址
 * @returns LP信息
 */
export async function getLpInfoByPoolAddress(poolAddress: string): Promise<LpInfo | null> {
  try {
    // 先从Redis缓存查询
    const cacheKey = `${lpInfoCache}:${poolAddress}`;
    const cacheData = await redisClient.get(cacheKey);
    if (cacheData) {
      return JSON.parse(cacheData) as LpInfo;
    }

    // 从数据库查询
    const sql = `
      SELECT id, pool_address, token_a_mint, token_b_mint, token_a_symbol, token_b_symbol,
             token_a_amount, token_b_amount, liquidity_usd, fee_rate,
             created_timestamp, last_updated_timestamp, created_at, updated_at
      FROM lp_info
      WHERE pool_address = ?
    `;

    const result = await commonQuery<LpInfo>(sql, [poolAddress]);
    const lpInfo = result[0] || null;

    if (lpInfo) {
      // 缓存到Redis（缓存30分钟）
      await redisClient.setex(cacheKey, 1800, JSON.stringify(lpInfo));
    }

    return lpInfo;
  } catch (error) {
    console.error(`Error in getLpInfoByPoolAddress for pool ${poolAddress}:`, error);
    throw error;
  }
}

/**
 * 3. 更新某个代币对的流动性价格，如果当前不存在这个交易对的话就创建
 * @param lpData - LP信息数据
 * @returns 更新或创建的LP信息
 */
export async function upsertLpInfo(lpData: LpInfoUpdate): Promise<LpInfo | null> {
  const currentTimestamp = BigInt(Date.now());

  const sql = `
    INSERT INTO lp_info (
      pool_address, token_a_mint, token_b_mint, token_a_symbol, token_b_symbol,
      token_a_amount, token_b_amount, liquidity_usd, fee_rate,
      created_timestamp, last_updated_timestamp, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      token_a_amount = VALUES(token_a_amount),
      token_b_amount = VALUES(token_b_amount),
      liquidity_usd = VALUES(liquidity_usd),
      fee_rate = VALUES(fee_rate),
      last_updated_timestamp = VALUES(last_updated_timestamp),
      updated_at = NOW()
  `;

  try {
    const result = await commonInsert(sql, [
      lpData.pool_address,
      lpData.token_a_mint,
      lpData.token_b_mint,
      lpData.token_a_symbol || '',
      lpData.token_b_symbol || '',
      lpData.token_a_amount.toString(),
      lpData.token_b_amount.toString(),
      lpData.liquidity_usd.toString(),
      lpData.fee_rate || 0,
      currentTimestamp.toString(),
      currentTimestamp.toString()
    ]);

    if (result.affectedRows > 0) {
      // 查询更新后的数据
      const updatedLpInfo = await getLpInfoByPoolAddress(lpData.pool_address);

      // 清除相关缓存
      await clearLpInfoCache(lpData.pool_address);

      return updatedLpInfo;
    }

    return null;
  } catch (error) {
    console.error('Error in upsertLpInfo:', error);
    throw error;
  }
}

export async function batchUpsertLpInfo(
    lpDataList: LpInfoUpdate[]
): Promise<{ successCount: number; failedPools: string[] }> {
  if (!lpDataList || lpDataList.length === 0) {
    return { successCount: 0, failedPools: [] };
  }

  const now = BigInt(Date.now());
  const values: any[] = [];
  const placeholders: string[] = [];

  for (const lp of lpDataList) {
    placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");

    values.push(
        lp.pool_address,
        lp.token_a_mint,
        lp.token_b_mint,
        lp.token_a_symbol || '',
        lp.token_b_symbol || '',
        lp.token_a_amount.toString(),
        lp.token_b_amount.toString(),
        lp.liquidity_usd.toString(),
        lp.fee_rate || 0,
        now.toString(),
        now.toString()
    );
  }

  const sql = `
    INSERT INTO lp_info (
      pool_address, token_a_mint, token_b_mint, token_a_symbol, token_b_symbol,
      token_a_amount, token_b_amount, liquidity_usd, fee_rate,
      created_timestamp, last_updated_timestamp, created_at, updated_at
    )
    VALUES ${placeholders.join(",")}
    ON DUPLICATE KEY UPDATE
      token_a_amount = VALUES(token_a_amount),
      token_b_amount = VALUES(token_b_amount),
      liquidity_usd = VALUES(liquidity_usd),
      fee_rate = VALUES(fee_rate),
      last_updated_timestamp = VALUES(last_updated_timestamp),
      updated_at = NOW()
  `;

  try {
    const result = await commonInsert(sql, values);
    const successCount = result.affectedRows;

    // 清除 Redis 缓存（并发执行）
    await Promise.all(
        lpDataList.map((lp) => clearLpInfoCache(lp.pool_address))
    );

    return { successCount, failedPools: [] };
  } catch (error) {
    console.error("Error in batchUpsertLpInfo:", error);

    // 提取失败的池地址
    const failedPools = lpDataList.map((lp) => lp.pool_address);
    return { successCount: 0, failedPools };
  }
}


// /**
//  * 4. 批量更新/创建LP信息
//  * @param lpDataList - LP信息数据列表
//  * @returns 批量操作结果
//  */
// export async function batchUpsertLpInfo(
//   lpDataList: LpInfoUpdate[]
// ): Promise<{ successCount: number; failedPools: string[] }> {
//   if (!lpDataList || lpDataList.length === 0) {
//     return { successCount: 0, failedPools: [] };
//   }
//
//   const failedPools: string[] = [];
//   let successCount = 0;
//
//   // 使用 Promise.allSettled 来处理批量操作
//   const upsertPromises = lpDataList.map(async (lpData) => {
//     try {
//       const result = await upsertLpInfo(lpData);
//       if (result) {
//         return { success: true, poolAddress: lpData.pool_address };
//       } else {
//         return { success: false, poolAddress: lpData.pool_address };
//       }
//     } catch (error) {
//       console.error(`Error upserting LP info for pool ${lpData.pool_address}:`, error);
//       return { success: false, poolAddress: lpData.pool_address };
//     }
//   });
//
//   const results = await Promise.allSettled(upsertPromises);
//
//   results.forEach((result, index) => {
//     if (result.status === 'fulfilled') {
//       if (result.value.success) {
//         successCount++;
//       } else {
//         failedPools.push(result.value.poolAddress);
//       }
//     } else {
//       failedPools.push(lpDataList[index].pool_address);
//     }
//   });
//
//   return { successCount, failedPools };
// }

/**
 * 分页查询LP信息
 * @param pageNum - 页码（从1开始）
 * @param pageSize - 每页大小
 * @param tokenFilter - 可选的token过滤器
 * @param minLiquidityUsd - 最小流动性USD过滤器
 * @returns 分页结果
 */
export async function getLpInfoByPage(
  pageNum: number = 1,
  pageSize: number = 20,
  tokenFilter?: string,
  minLiquidityUsd?: number
): Promise<{
  data: LpInfo[];
  total: number;
  pageNum: number;
  pageSize: number;
  totalPages: number;
}> {
  try {
    // 确保参数是整数类型
    const pageNumber = Math.max(1, Math.floor(Number(pageNum)));
    const pageSizeNumber = Math.max(1, Math.floor(Number(pageSize)));
    const offset = (pageNumber - 1) * pageSizeNumber;
    const queryParams: any[] = [];

    let baseSql = `
      SELECT id, pool_address, token_a_mint, token_b_mint, token_a_symbol, token_b_symbol,
             token_a_amount, token_b_amount, liquidity_usd, fee_rate,
             created_timestamp, last_updated_timestamp, created_at, updated_at
      FROM lp_info
    `;

    let countSql = `SELECT COUNT(*) as total FROM lp_info`;
    let whereConditions: string[] = [];

    // 添加token过滤条件
    if (tokenFilter && tokenFilter.trim()) {
      whereConditions.push(`(token_a_mint = ? OR token_b_mint = ? OR token_a_symbol LIKE ? OR token_b_symbol LIKE ?)`);
      const likePattern = `%${tokenFilter.trim()}%`;
      queryParams.push(tokenFilter, tokenFilter, likePattern, likePattern);
    }

    // 添加最小流动性过滤条件
    if (minLiquidityUsd !== undefined && minLiquidityUsd > 0) {
      whereConditions.push(`liquidity_usd >= ?`);
      queryParams.push(Math.floor(Number(minLiquidityUsd)));
    }

    // 构建WHERE子句
    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`;
      baseSql += whereClause;
      countSql += whereClause;
    }

    // 添加排序（不包含LIMIT和OFFSET）
    baseSql += ` ORDER BY liquidity_usd DESC, last_updated_timestamp DESC`;

    // 执行查询 - 使用专门的分页查询函数
    const [dataResult, countResult] = await Promise.all([
      commonQueryWithPagination<LpInfo>(baseSql, queryParams, pageSizeNumber, offset),
      commonQuery<{ total: number }>(countSql, queryParams)
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSizeNumber);

    return {
      data: dataResult,
      total,
      pageNum: pageNumber,
      pageSize: pageSizeNumber,
      totalPages
    };
  } catch (error) {
    console.error('Error in getLpInfoByPage:', error);
    throw error;
  }
}

/**
 * 删除LP信息
 * @param poolAddress - 池地址
 * @returns 是否删除成功
 */
export async function deleteLpInfo(poolAddress: string): Promise<boolean> {
  const sql = `DELETE FROM lp_info WHERE pool_address = ?`;

  try {
    const affectedRows = await commonDelete(sql, [poolAddress]);

    // 清除缓存
    await clearLpInfoCache(poolAddress);

    return affectedRows > 0;
  } catch (error) {
    console.error(`Error deleting LP info for pool ${poolAddress}:`, error);
    return false;
  }
}

/**
 * 清除LP信息缓存
 * @param poolAddress - 池地址
 */
async function clearLpInfoCache(poolAddress: string): Promise<void> {
  try {
    const cacheKey = `${lpInfoCache}:${poolAddress}`;
    await redisClient.del(cacheKey);
  } catch (error) {
    console.error(`Error clearing cache for pool ${poolAddress}:`, error);
  }
}

/**
 * 获取流动性最高的LP池
 * @param limit - 返回数量限制
 * @returns 流动性最高的LP池列表
 */
export async function getTopLiquidityPools(limit: number = 50): Promise<LpInfo[]> {
  const sql = `
    SELECT id, pool_address, token_a_mint, token_b_mint, token_a_symbol, token_b_symbol,
           token_a_amount, token_b_amount, liquidity_usd, fee_rate,
           created_timestamp, last_updated_timestamp, created_at, updated_at
    FROM lp_info
    WHERE liquidity_usd > 0
    ORDER BY liquidity_usd DESC
    LIMIT ?
  `;

  try {
    const result = await commonQuery<LpInfo>(sql, [limit]);
    return result;
  } catch (error) {
    console.error('Error in getTopLiquidityPools:', error);
    throw error;
  }
}
