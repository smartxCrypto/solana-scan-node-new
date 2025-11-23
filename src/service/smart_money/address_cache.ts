import redisClient from "../../constant/config/redis";
import { SmartMoneyAddressService } from "./address";

/**
 * 缓存配置接口
 */
interface CacheConfig {
    keyPrefix: string;
    ttlSeconds: number;
    autoRefreshThreshold: number; // 自动刷新阈值（秒）
}

/**
 * 聪明钱地址缓存结果接口
 */
interface CacheResult {
    addresses: string[];
    fromCache: boolean;
    lastUpdated: number;
    nextExpiry: number;
}

/**
 * 聪明钱地址缓存服务类
 */
export class SmartMoneyAddressCache {
    private cacheConfig: CacheConfig;
    private lastRefreshTime: number = 0;

    constructor(cacheConfig?: Partial<CacheConfig>) {
        this.cacheConfig = {
            keyPrefix: "smart_money_addresses",
            ttlSeconds: 3600, // 1小时
            autoRefreshThreshold: 300, // 5分钟内自动刷新
            ...cacheConfig
        };
    }

    /**
     * 获取缓存键名
     */
    private getCacheKey(): string {
        return `${this.cacheConfig.keyPrefix}:list`;
    }

    /**
     * 获取缓存时间戳键名
     */
    private getTimestampKey(): string {
        return `${this.cacheConfig.keyPrefix}:timestamp`;
    }

    /**
     * 主动更新：重新从数据库查询并更新Redis
     */
    async forceRefresh(): Promise<CacheResult> {
        try {
            console.log("Force refreshing smart money addresses from database...");

            // 从数据库获取所有聪明钱地址
            const addresses = await this.fetchAddressesFromDatabase();

            // 更新Redis缓存
            await this.updateCache(addresses);

            const currentTime = Date.now();
            this.lastRefreshTime = currentTime;

            console.log(`Smart money addresses cache updated: ${addresses.length} addresses`);

            return {
                addresses,
                fromCache: false,
                lastUpdated: currentTime,
                nextExpiry: currentTime + (this.cacheConfig.ttlSeconds * 1000)
            };

        } catch (error) {
            console.error("Failed to force refresh smart money addresses:", error);
            throw new Error(`Force refresh failed: ${error}`);
        }
    }

    /**
     * 查询获取聪明钱地址列表（带自动刷新逻辑）
     */
    async getSmartMoneyAddresses(): Promise<CacheResult> {
        try {
            // 检查缓存是否存在
            const cachedAddresses = await this.getCachedAddresses();
            const cachedTimestamp = await this.getCachedTimestamp();
            const currentTime = Date.now();

            // 如果缓存存在且未过期
            if (cachedAddresses && cachedTimestamp) {
                const cacheAge = currentTime - cachedTimestamp;
                const ttlMs = this.cacheConfig.ttlSeconds * 1000;

                // 缓存仍然有效
                if (cacheAge < ttlMs) {
                    // 检查是否接近过期，需要预刷新
                    const refreshThresholdMs = this.cacheConfig.autoRefreshThreshold * 1000;
                    const shouldPreRefresh = (ttlMs - cacheAge) < refreshThresholdMs;

                    if (shouldPreRefresh) {
                        // 异步预刷新，不阻塞当前请求
                        this.asyncRefresh().catch(error =>
                            console.warn("Async refresh failed:", error)
                        );
                    }

                    return {
                        addresses: cachedAddresses,
                        fromCache: true,
                        lastUpdated: cachedTimestamp,
                        nextExpiry: cachedTimestamp + ttlMs
                    };
                }
            }

            // 缓存不存在或已过期，强制刷新
            console.log("Smart money addresses cache expired or empty, refreshing...");
            return await this.forceRefresh();

        } catch (error) {
            console.error("Failed to get smart money addresses:", error);

            // 如果Redis出错，尝试直接从数据库查询
            try {
                console.log("Fallback to database query...");
                const addresses = await this.fetchAddressesFromDatabase();
                const currentTime = Date.now();

                return {
                    addresses,
                    fromCache: false,
                    lastUpdated: currentTime,
                    nextExpiry: currentTime + (this.cacheConfig.ttlSeconds * 1000)
                };
            } catch (dbError) {
                console.error("Database fallback also failed:", dbError);
                throw new Error(`Both cache and database query failed: ${error}, ${dbError}`);
            }
        }
    }

    /**
     * 检查缓存状态
     */
    async getCacheStatus(): Promise<{
        hasCache: boolean;
        cacheSize: number;
        lastUpdated: number | null;
        ttlRemaining: number | null;
    }> {
        try {
            const cachedAddresses = await this.getCachedAddresses();
            const cachedTimestamp = await this.getCachedTimestamp();
            const currentTime = Date.now();

            let ttlRemaining = null;
            if (cachedTimestamp) {
                const cacheAge = currentTime - cachedTimestamp;
                const ttlMs = this.cacheConfig.ttlSeconds * 1000;
                ttlRemaining = Math.max(0, ttlMs - cacheAge);
            }

            return {
                hasCache: !!cachedAddresses,
                cacheSize: cachedAddresses ? cachedAddresses.length : 0,
                lastUpdated: cachedTimestamp,
                ttlRemaining
            };
        } catch (error) {
            console.error("Failed to get cache status:", error);
            return {
                hasCache: false,
                cacheSize: 0,
                lastUpdated: null,
                ttlRemaining: null
            };
        }
    }

    /**
     * 清除缓存
     */
    async clearCache(): Promise<void> {
        try {
            await redisClient.del(this.getCacheKey());
            await redisClient.del(this.getTimestampKey());
            console.log("Smart money addresses cache cleared");
        } catch (error) {
            console.error("Failed to clear cache:", error);
            throw new Error(`Clear cache failed: ${error}`);
        }
    }

    // ===== 私有方法 =====

    /**
     * 从数据库获取聪明钱地址
     */
    private async fetchAddressesFromDatabase(): Promise<string[]> {
        try {
            // 获取所有有效的聪明钱地址 - 这个方法直接返回string[]
            const addresses = await SmartMoneyAddressService.getAllSmartMoneyAddresses();

            // 去重
            const uniqueAddresses = [...new Set(addresses)];

            console.log(`Fetched ${uniqueAddresses.length} unique smart money addresses from database`);
            return uniqueAddresses;

        } catch (error) {
            console.error("Failed to fetch addresses from database:", error);
            throw new Error(`Database query failed: ${error}`);
        }
    }

    /**
     * 更新缓存
     */
    private async updateCache(addresses: string[]): Promise<void> {
        const currentTime = Date.now();

        try {
            // 删除旧缓存
            await redisClient.del(this.getCacheKey());
            await redisClient.del(this.getTimestampKey());

            // 如果有地址，则添加到缓存
            if (addresses.length > 0) {
                // 将地址数组存储为JSON字符串
                await redisClient.set(this.getCacheKey(), JSON.stringify(addresses));
                await redisClient.expire(this.getCacheKey(), this.cacheConfig.ttlSeconds);
            }

            // 设置时间戳
            await redisClient.set(this.getTimestampKey(), currentTime.toString());
            await redisClient.expire(this.getTimestampKey(), this.cacheConfig.ttlSeconds);

        } catch (error) {
            console.error("Failed to update cache:", error);
            throw new Error(`Cache update failed: ${error}`);
        }
    }

    /**
     * 获取缓存的地址列表
     */
    private async getCachedAddresses(): Promise<string[] | null> {
        try {
            const cached = await redisClient.get(this.getCacheKey());
            if (cached) {
                return JSON.parse(cached) as string[];
            }
            return null;
        } catch (error) {
            console.error("Failed to get cached addresses:", error);
            return null;
        }
    }

    /**
     * 获取缓存的时间戳
     */
    private async getCachedTimestamp(): Promise<number | null> {
        try {
            const timestamp = await redisClient.get(this.getTimestampKey());
            return timestamp ? parseInt(timestamp, 10) : null;
        } catch (error) {
            console.error("Failed to get cached timestamp:", error);
            return null;
        }
    }

    /**
     * 异步刷新缓存（后台操作）
     */
    private async asyncRefresh(): Promise<void> {
        try {
            // 防止并发刷新
            const currentTime = Date.now();
            if (currentTime - this.lastRefreshTime < 30000) { // 30秒内不重复刷新
                return;
            }

            console.log("Background refreshing smart money addresses cache...");
            await this.forceRefresh();
        } catch (error) {
            console.error("Background refresh failed:", error);
        }
    }
}

/**
 * 全局单例实例
 */
export const smartMoneyAddressCache = new SmartMoneyAddressCache();

/**
 * 便捷方法：获取聪明钱地址列表
 */
export async function getSmartMoneyAddresses(): Promise<string[]> {
    const result = await smartMoneyAddressCache.getSmartMoneyAddresses();
    return result.addresses;
}

/**
 * 便捷方法：强制刷新缓存
 */
export async function refreshSmartMoneyAddresses(): Promise<string[]> {
    const result = await smartMoneyAddressCache.forceRefresh();
    return result.addresses;
}

/**
 * 便捷方法：检查地址是否为聪明钱
 */
export async function isSmartMoneyAddress(address: string): Promise<boolean> {
    const addresses = await getSmartMoneyAddresses();
    return addresses.includes(address);
}

/**
 * 便捷方法：批量检查地址是否为聪明钱
 */
export async function filterSmartMoneyAddresses(addresses: string[]): Promise<{
    smartMoney: string[];
    normal: string[];
}> {
    const smartMoneyAddresses = await getSmartMoneyAddresses();
    const smartMoneySet = new Set(smartMoneyAddresses);

    const smartMoney: string[] = [];
    const normal: string[] = [];

    for (const address of addresses) {
        if (smartMoneySet.has(address)) {
            smartMoney.push(address);
        } else {
            normal.push(address);
        }
    }

    return { smartMoney, normal };
}
