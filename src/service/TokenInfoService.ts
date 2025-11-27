import redisClient from "../constant/config/redis";
import { fetchTokenMetadataService } from "./FetchTokenMetadataService";
import { TokenRepository } from "@/database/repositories";
import type { TokenInfo } from "@/type/token";
import { SolScanAPi } from "@/utils/solscanUtl";

const tokenInfoCache = "token_info_cache";

/**
 * 主方法：先从 Redis 查找 token 信息，查不到则查数据库，查不到则 fetch 并写入
 */
export async function getTokenInfoUseCache(
  tokenAddress: string,
): Promise<TokenInfo | null> {
  try {
    const tokenIncaseAddress = tokenAddress.toLowerCase();
    const cacheData = await redisClient.hget(
      tokenInfoCache,
      tokenIncaseAddress,
    );
    if (cacheData) {
      return JSON.parse(cacheData as string) as TokenInfo;
    }

    const dbData = await getTokenInfoFromDB(tokenIncaseAddress);
    if (dbData) {
      return dbData;
    }
    createTokenInfo(tokenAddress);
  } catch (e) {
    // console.log("query token info failed:", tokenAddress);
  }
  return null;
}

/**
 * 查询数据库中的 token 信息，并写入 Redis 缓存
 */
export async function getTokenInfoFromDB(
  tokenAddress: string,
): Promise<TokenInfo | null> {
  try {
    const dbRecord = await TokenRepository.findByAddress(tokenAddress);
    if (!dbRecord) {
      return null;
    }

    const tokenInfo = mapTokenRecordToInfo(dbRecord);
    await redisClient.hset(
      tokenInfoCache,
      tokenAddress,
      JSON.stringify(tokenInfo),
    );
    return tokenInfo;
  } catch (error) {
    console.error("Error in getTokenInfoFromDB:", error);
    throw error;
  }
}

export async function createTokenInfo(
  tokenAddress: string,
): Promise<TokenInfo | null> {
  const tokenMetadata = await fetchTokenMetadataService.fetch(tokenAddress);
  if (!tokenMetadata) {
    const emptyTokenInfo: TokenInfo = {
      token_address: tokenAddress,
      name: "",
      decimals: 0,
      total_supply: 0,
      meta_uri: "",
      logo_url: "",
    };
    await redisClient.hset(
      tokenInfoCache,
      tokenAddress,
      JSON.stringify(emptyTokenInfo),
    );
    return emptyTokenInfo;
  }

  const tokenInfo: TokenInfo = {
    token_address: tokenAddress,
    name: tokenMetadata.name,
    symbol: tokenMetadata.symbol,
    decimals: tokenMetadata.decimals,
    total_supply: tokenMetadata.supply,
    meta_uri: tokenMetadata.uri,
    logo_url: tokenMetadata.image,
  };

  const solscanUtl = new SolScanAPi();

  const solscanTokenInfo = await solscanUtl.getTokenInfo(tokenAddress);
  if (solscanTokenInfo) {
    tokenInfo.sol_scan_image = solscanTokenInfo.icon;
    tokenInfo.website_url = solscanTokenInfo.metadata?.website;
    tokenInfo.twitter_url = solscanTokenInfo.metadata?.twitter;
    tokenInfo.first_seen_timestamp = solscanTokenInfo.created_time;
    tokenInfo.token_create_ts = solscanTokenInfo.created_time;
    tokenInfo.latest_price = solscanTokenInfo.price;
    tokenInfo.creator_address = solscanTokenInfo.creator;
    tokenInfo.create_tx = solscanTokenInfo.create_tx;
  }

  try {
    const dbData = mapTokenInfoToRecord(tokenInfo);
    await TokenRepository.upsert(dbData);

    await redisClient.hset(
      tokenInfoCache,
      tokenAddress,
      JSON.stringify(tokenInfo),
    );
    return tokenInfo;
  } catch (error) {
    console.error("Error creating token info:", error);
  }

  return null;
}

/**
 * 分页查询 token 信息
 * @param pageNum 页码（从1开始）
 * @param pageSize 每页大小
 * @param searchKeyword 可选的搜索关键词（按名称或符号搜索）
 * @returns 返回分页结果和总数
 */
export async function getTokenInfoByPage(
  pageNum: number = 1,
  pageSize: number = 10,
  searchKeyword?: string
): Promise<{
  data: TokenInfo[];
  total: number;
  pageNum: number;
  pageSize: number;
  totalPages: number;
}> {
  try {
    const pageNumber = Math.max(1, Math.floor(Number(pageNum)));
    const pageSizeNumber = Math.max(1, Math.floor(Number(pageSize)));

    const { data, total } = await TokenRepository.findByPage({
      page: pageNumber,
      pageSize: pageSizeNumber,
      searchKeyword
    });

    return {
      data: data.map(mapTokenRecordToInfo),
      total,
      pageNum: pageNumber,
      pageSize: pageSizeNumber,
      totalPages: Math.ceil(total / pageSizeNumber)
    };
  } catch (error) {
    console.error("Error in getTokenInfoByPage:", error);
    throw error;
  }
}

/**
 * 批量更新 token 信息
 * @param tokenInfos 要更新的 token 信息数组
 * @returns 返回更新成功的数量
 */
export async function batchUpdateTokenInfo(
  tokenInfos: TokenInfo[]
): Promise<{ successCount: number; failedTokens: string[] }> {
  if (!tokenInfos || tokenInfos.length === 0) {
    return { successCount: 0, failedTokens: [] };
  }

  const failedTokens: string[] = [];
  let successCount = 0;

  const updatePromises = tokenInfos.map(async (tokenInfo) => {
    try {
      const dbData = mapTokenInfoToRecord(tokenInfo);
      await TokenRepository.upsert(dbData);

      await redisClient.hset(
        tokenInfoCache,
        tokenInfo.token_address.toLowerCase(),
        JSON.stringify(tokenInfo)
      );
      return { success: true, tokenAddress: tokenInfo.token_address };
    } catch (error) {
      console.error(`Error updating token ${tokenInfo.token_address}:`, error);
      return { success: false, tokenAddress: tokenInfo.token_address };
    }
  });

  const results = await Promise.allSettled(updatePromises);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        successCount++;
      } else {
        failedTokens.push(result.value.tokenAddress);
      }
    } else {
      failedTokens.push(tokenInfos[index].token_address || `index_${index}`);
    }
  });

  return { successCount, failedTokens };
}

/**
 * 批量删除 token 信息
 * @param tokenAddresses 要删除的 token 地址数组
 * @returns 返回删除成功的数量
 */
export async function batchDeleteTokenInfo(
  tokenAddresses: string[]
): Promise<{ successCount: number; failedTokens: string[] }> {
  if (!tokenAddresses || tokenAddresses.length === 0) {
    return { successCount: 0, failedTokens: [] };
  }

  const failedTokens: string[] = [];
  let successCount = 0;

  const deletePromises = tokenAddresses.map(async (tokenAddress) => {
    try {
      const deleted = await TokenRepository.delete(tokenAddress);

      await redisClient.hdel(tokenInfoCache, tokenAddress.toLowerCase());

      return { success: deleted, tokenAddress };
    } catch (error) {
      console.error(`Error deleting token ${tokenAddress}:`, error);
      return { success: false, tokenAddress };
    }
  });

  const results = await Promise.allSettled(deletePromises);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        successCount++;
      } else {
        failedTokens.push(result.value.tokenAddress);
      }
    } else {
      failedTokens.push(tokenAddresses[index]);
    }
  });

  return { successCount, failedTokens };
}

/**
 * 分页查询 sol_scan_image 为空的 token 信息
 * @param pageNum 页码（从1开始）
 * @param pageSize 每页大小
 * @returns 返回分页结果和总数
 */
export async function getTokensWithEmptySolScanImage(
  pageNum: number = 1,
  pageSize: number = 20
): Promise<{
  data: TokenInfo[];
  total: number;
  pageNum: number;
  pageSize: number;
  totalPages: number;
}> {
  try {
    const pageNumber = Math.max(1, Math.floor(Number(pageNum)));
    const pageSizeNumber = Math.max(1, Math.floor(Number(pageSize)));

    const { data, total } = await TokenRepository.findWithEmptySolScanImage({
      page: pageNumber,
      pageSize: pageSizeNumber
    });

    return {
      data: data.map(mapTokenRecordToInfo),
      total,
      pageNum: pageNumber,
      pageSize: pageSizeNumber,
      totalPages: Math.ceil(total / pageSizeNumber)
    };
  } catch (error) {
    console.error("Error in getTokensWithEmptySolScanImage:", error);
    throw error;
  }
}

// Helper functions to map between database records and TokenInfo
function mapTokenRecordToInfo(record: any): TokenInfo {
  return {
    id: String(record.id),
    token_address: record.tokenAddress,
    name: record.name || "",
    symbol: record.symbol || "",
    decimals: record.decimals || 0,
    total_supply: Number(record.totalSupply || 0),
    meta_uri: record.metaUri || "",
    logo_url: record.logoUrl || "",
    website_url: record.websiteUrl || "",
    twitter_url: record.twitterUrl || "",
    telegram_url: record.telegramUrl || "",
    is_risk_token: record.isRiskToken || false,
    first_seen_timestamp: Number(record.firstSeenTimestamp || 0),
    token_create_ts: Number(record.tokenCreateTs || 0),
    latest_price: record.latestPrice || 0,
    creator_address: record.creatorAddress || "",
    create_tx: record.createTx || "",
    sol_scan_image: record.solScanImage || "",
    created_at: record.createdAt ? new Date(record.createdAt).toISOString() : undefined,
    updated_at: record.updatedAt ? new Date(record.updatedAt).toISOString() : undefined,
  };
}

function mapTokenInfoToRecord(tokenInfo: TokenInfo): any {
  return {
    tokenAddress: tokenInfo.token_address,
    name: tokenInfo.name || "",
    symbol: tokenInfo.symbol || "",
    decimals: tokenInfo.decimals || 0,
    totalSupply: BigInt(tokenInfo.total_supply || 0),
    metaUri: tokenInfo.meta_uri || "",
    logoUrl: tokenInfo.logo_url || "",
    websiteUrl: tokenInfo.website_url || "",
    twitterUrl: tokenInfo.twitter_url || "",
    telegramUrl: tokenInfo.telegram_url || "",
    isRiskToken: tokenInfo.is_risk_token || false,
    firstSeenTimestamp: BigInt(tokenInfo.first_seen_timestamp || Date.now()),
    tokenCreateTs: BigInt(tokenInfo.token_create_ts || Date.now()),
    latestPrice: tokenInfo.latest_price || 0,
    creatorAddress: tokenInfo.creator_address || "",
    createTx: tokenInfo.create_tx || "",
    solScanImage: tokenInfo.sol_scan_image || "",
  };
}
