import redisClient from "../constant/config/redis";
import { fetchTokenMetadataService } from "./FetchTokenMetadataService";
import { commonQuery, commonInsert, commonQueryWithPagination } from "../utils/mysqlHelper";
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
  const sql = `
    SELECT id, token_address, name, symbol, decimals, total_supply, meta_uri, logo_url,
           website_url, twitter_url, telegram_url, is_risk_token, first_seen_timestamp,
           created_at, updated_at, token_create_ts, latest_price, creator_address, create_tx, sol_scan_image
    FROM tokens
    WHERE token_address = ?
  `;
  try {
    const result = await commonQuery<TokenInfo>(sql, [tokenAddress]);
    const dbData = result[0];
    if (dbData) {
      await redisClient.hset(
        tokenInfoCache,
        tokenAddress,
        JSON.stringify(dbData),
      );
      return dbData;
    }
    return null;
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
    tokenInfo.creator_address = solscanTokenInfo.creator;
    tokenInfo.create_tx = solscanTokenInfo.create_tx;
    tokenInfo.latest_price = solscanTokenInfo.price;
  }

  const insertSql = `
            INSERT INTO tokens (token_address, name, symbol, decimals, total_supply, meta_uri, logo_url,
                              website_url, twitter_url, telegram_url, is_risk_token, first_seen_timestamp,
                              token_create_ts, latest_price, creator_address, create_tx, sol_scan_image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY
            UPDATE
                name = VALUES(name), 
                symbol = VALUES(symbol), 
                decimals = VALUES(decimals), 
                total_supply = VALUES(total_supply), 
                meta_uri = VALUES(meta_uri), 
                logo_url = VALUES(logo_url),
                website_url = VALUES(website_url),
                twitter_url = VALUES(twitter_url),
                telegram_url = VALUES(telegram_url),
                is_risk_token = VALUES(is_risk_token),
                latest_price = VALUES(latest_price),
                updated_at = CURRENT_TIMESTAMP
        `;

  try {
    const currentTimestamp = Date.now();
    const result = await commonInsert(insertSql, [
      tokenAddress,
      tokenInfo.name,
      tokenInfo.symbol || "",
      tokenInfo.decimals,
      tokenInfo.total_supply,
      tokenInfo.meta_uri || "",
      tokenInfo.logo_url || "",
      tokenInfo.website_url || "",
      tokenInfo.twitter_url || "",
      tokenInfo.telegram_url || "",
      false, // is_risk_token
      currentTimestamp, // first_seen_timestamp
      currentTimestamp, // token_create_ts
      tokenInfo.latest_price || 0,
      tokenInfo.creator_address || "",
      tokenInfo.create_tx || "",
      tokenInfo.sol_scan_image || ""
    ]);

    if (result.affectedRows > 0) {
      await redisClient.hset(
        tokenInfoCache,
        tokenAddress,
        JSON.stringify(tokenInfo),
      );
      return tokenInfo;
    }
  } catch (error) {
    console.error("Error creating token info:", error);
  }

  return null;
}
// const tokenInfo =await getTokenInfoUseCache("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
// console.log(tokenInfo);

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
    // 确保参数是整数类型
    const pageNumber = Math.max(1, Math.floor(Number(pageNum)));
    const pageSizeNumber = Math.max(1, Math.floor(Number(pageSize)));
    const offset = (pageNumber - 1) * pageSizeNumber;

    // 构建基础查询语句（不包含LIMIT和OFFSET）
    let baseSql = `
      SELECT id, token_address, name, symbol, decimals, total_supply, meta_uri, logo_url,
             website_url, twitter_url, telegram_url, is_risk_token, first_seen_timestamp,
             created_at, updated_at, token_create_ts, latest_price, creator_address, create_tx, sol_scan_image
      FROM tokens
    `;

    let countSql = `SELECT COUNT(*) as total FROM tokens`;
    const queryParams: any[] = [];

    // 如果有搜索关键词，添加WHERE条件
    if (searchKeyword && searchKeyword.trim()) {
      const whereClause = ` WHERE (name LIKE ? OR symbol LIKE ? OR token_address LIKE ?)`;
      baseSql += whereClause;
      countSql += whereClause;

      const searchPattern = `%${searchKeyword.trim()}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // 添加排序（不包含LIMIT和OFFSET）
    baseSql += ` ORDER BY created_at DESC, name ASC`;

    // 执行查询 - 使用专门的分页查询函数
    const [dataResult, countResult] = await Promise.all([
      commonQueryWithPagination<TokenInfo>(baseSql, queryParams, pageSizeNumber, offset),
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

  // 使用 Promise.allSettled 来处理批量操作，避免一个失败影响其他
  const updatePromises = tokenInfos.map(async (tokenInfo) => {
    const updateSql = `
      INSERT INTO tokens (token_address, name, symbol, decimals, total_supply, meta_uri, logo_url,
                         website_url, twitter_url, telegram_url, is_risk_token, first_seen_timestamp,
                         token_create_ts, latest_price, creator_address, create_tx, sol_scan_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE
        name = VALUES(name), 
        symbol = VALUES(symbol), 
        decimals = VALUES(decimals), 
        total_supply = VALUES(total_supply), 
        meta_uri = VALUES(meta_uri), 
        logo_url = VALUES(logo_url),
        website_url = VALUES(website_url),
        twitter_url = VALUES(twitter_url),
        telegram_url = VALUES(telegram_url),
        is_risk_token = VALUES(is_risk_token),
        latest_price = VALUES(latest_price),
        creator_address = VALUES(creator_address),
        create_tx = VALUES(create_tx),
        updated_at = CURRENT_TIMESTAMP,
        sol_scan_image = VALUES(sol_scan_image)
    `;

    try {
      const currentTimestamp = Date.now();
      const result = await commonInsert(updateSql, [
        tokenInfo.token_address,
        tokenInfo.name || '',
        tokenInfo.symbol || '',
        tokenInfo.decimals || 0,
        tokenInfo.total_supply || 0,
        tokenInfo.meta_uri || '',
        tokenInfo.logo_url || '',
        tokenInfo.website_url || '',
        tokenInfo.twitter_url || '',
        tokenInfo.telegram_url || '',
        tokenInfo.is_risk_token || false,
        tokenInfo.first_seen_timestamp || currentTimestamp,
        tokenInfo.token_create_ts || currentTimestamp,
        tokenInfo.latest_price || 0,
        tokenInfo.creator_address || '',
        tokenInfo.create_tx || '',
        tokenInfo.sol_scan_image || ''
      ]);

      if (result.affectedRows > 0) {
        // 同时更新 Redis 缓存
        await redisClient.hset(
          tokenInfoCache,
          tokenInfo.token_address.toLowerCase(),
          JSON.stringify(tokenInfo)
        );
        return { success: true, tokenAddress: tokenInfo.token_address };
      } else {
        return { success: false, tokenAddress: tokenInfo.token_address };
      }
    } catch (error) {
      console.error(`Error updating token ${tokenInfo.token_address}:`, error);
      return { success: false, tokenAddress: tokenInfo.token_address };
    }
  });

  // 等待所有更新操作完成
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
 * 批量删除 token 信息（附加方法）
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
    const deleteSql = `DELETE FROM tokens WHERE token_address = ?`;

    try {
      const result = await commonQuery(deleteSql, [tokenAddress]);

      // 同时删除 Redis 缓存
      await redisClient.hdel(tokenInfoCache, tokenAddress.toLowerCase());

      return { success: true, tokenAddress };
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
    // 确保参数是整数类型
    const pageNumber = Math.max(1, Math.floor(Number(pageNum)));
    const pageSizeNumber = Math.max(1, Math.floor(Number(pageSize)));
    const offset = (pageNumber - 1) * pageSizeNumber;

    // 构建查询语句 - 查询 sol_scan_image 为空或 NULL 的记录
    const baseSql = `
      SELECT id, token_address, name, symbol, decimals, total_supply, meta_uri, logo_url,
             website_url, twitter_url, telegram_url, is_risk_token, first_seen_timestamp,
             created_at, updated_at, token_create_ts, latest_price, creator_address, create_tx, sol_scan_image
      FROM tokens
      WHERE (sol_scan_image IS NULL OR sol_scan_image = '' OR sol_scan_image = 'null')
      ORDER BY created_at DESC, name ASC
    `;

    const countSql = `
      SELECT COUNT(*) as total 
      FROM tokens 
      WHERE (sol_scan_image IS NULL OR sol_scan_image = '' OR sol_scan_image = 'null')
    `;

    // 执行查询
    const [dataResult, countResult] = await Promise.all([
      commonQueryWithPagination<TokenInfo>(baseSql, [], pageSizeNumber, offset),
      commonQuery<{ total: number }>(countSql, [])
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
    console.error("Error in getTokensWithEmptySolScanImage:", error);
    throw error;
  }
}
