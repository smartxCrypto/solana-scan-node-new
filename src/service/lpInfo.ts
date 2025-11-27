import redisClient from "@/constant/config/redis";
import { LpInfoRepository } from "@/database/repositories";
import type { LpInfo as LpInfoRecord, NewLpInfo } from "@/database/schema/lp-info";

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
  token_a_amount: number;
  token_b_amount: number;
  liquidity_usd: number;
  fee_rate: number;
  created_timestamp: number;
  last_updated_timestamp: number;
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
  try {
    const result = await LpInfoRepository.findByToken(tokenMint);
    return result.map(mapRecordToLegacy);
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
  try {
    const result = await LpInfoRepository.findByTokenPair(tokenA, tokenB);
    return result.map(mapRecordToLegacy);
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

    const record = await LpInfoRepository.findByPoolAddress(poolAddress);
    const lpInfo = record ? mapRecordToLegacy(record) : null;

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
  const timestamp = lpData.transactinTimeTs || Date.now();

  try {
    const dbData = mapUpdateToDbData(lpData, timestamp);
    await LpInfoRepository.upsert(dbData);

    // 查询更新后的数据
    const updatedLpInfo = await getLpInfoByPoolAddress(lpData.pool_address);

    // 清除相关缓存
    await clearLpInfoCache(lpData.pool_address);

    return updatedLpInfo;
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

  try {
    const timestamp = Date.now();
    const dbDataList = lpDataList.map((lp) => mapUpdateToDbData(lp, timestamp));
    const successCount = await LpInfoRepository.batchUpsert(dbDataList);

    await Promise.all(
        lpDataList.map((lp) => clearLpInfoCache(lp.pool_address))
    );

    return { successCount, failedPools: [] };
  } catch (error) {
    console.error("Error in batchUpsertLpInfo:", error);
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
    const pageNumber = Math.max(1, Math.floor(Number(pageNum)));
    const pageSizeNumber = Math.max(1, Math.floor(Number(pageSize)));

    const { data, total } = await LpInfoRepository.findByPage({
      page: pageNumber,
      pageSize: pageSizeNumber,
      tokenFilter,
      minLiquidityUsd
    });

    return {
      data: data.map(mapRecordToLegacy),
      total,
      pageNum: pageNumber,
      pageSize: pageSizeNumber,
      totalPages: Math.ceil(total / pageSizeNumber)
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
  try {
    const deleted = await LpInfoRepository.delete(poolAddress);

    if (deleted) {
      await clearLpInfoCache(poolAddress);
    }

    return deleted;
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
  try {
    const result = await LpInfoRepository.getTopLiquidityPools(limit);
    return result.map(mapRecordToLegacy);
  } catch (error) {
    console.error('Error in getTopLiquidityPools:', error);
    throw error;
  }
}

function mapRecordToLegacy(record: LpInfoRecord): LpInfo {
  return {
    id: record.id,
    pool_address: record.poolAddress,
    token_a_mint: record.tokenAMint,
    token_b_mint: record.tokenBMint,
    token_a_symbol: record.tokenASymbol,
    token_b_symbol: record.tokenBSymbol,
    token_a_amount: record.tokenAAmount,
    token_b_amount: record.tokenBAmount,
    liquidity_usd: record.liquidityUsd,
    fee_rate: record.feeRate,
    created_timestamp: record.createdTimestamp,
    last_updated_timestamp: record.lastUpdatedTimestamp,
    created_at: record.createdAt ? record.createdAt.toISOString?.() ?? String(record.createdAt) : undefined,
    updated_at: record.updatedAt ? record.updatedAt.toISOString?.() ?? String(record.updatedAt) : undefined,
  };
}

function mapUpdateToDbData(lpData: LpInfoUpdate, timestamp: number) {
  return {
    poolAddress: lpData.pool_address,
    tokenAMint: lpData.token_a_mint,
    tokenBMint: lpData.token_b_mint,
    tokenASymbol: lpData.token_a_symbol || '',
    tokenBSymbol: lpData.token_b_symbol || '',
    tokenAAmount: Number(lpData.token_a_amount),
    tokenBAmount: Number(lpData.token_b_amount),
    liquidityUsd: Number(lpData.liquidity_usd),
    feeRate: lpData.fee_rate ?? 0,
    createdTimestamp: timestamp,
    lastUpdatedTimestamp: timestamp,
  } as Omit<NewLpInfo, 'id' | 'createdAt' | 'updatedAt'>;
}
