// config/redis

import dotenv from "dotenv";
import { createClient } from "redis";

// 加载环境变量
dotenv.config();

class RedisClient {
    public client: ReturnType<typeof createClient>;

    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        this.client.connect();
    }

    async get(key: string) {
        return await this.client.get(key);
    }

    async set(key: string, value: string, options: { EX?: number, PX?: number, NX?: boolean, XX?: boolean } = {}) {
        return await this.client.set(key, value, options);
    }

    async setex(key: string, seconds: number, value: string) {
        return await this.client.setEx(key, seconds, value);
    }

    async hget(key: string, field: string) {
        return await this.client.hGet(key, field);
    }

    async hset(key: string, field: string, value: string) {
        return await this.client.hSet(key, field, value);
    }

    async hdel(key: string, field: string) {
        return await this.client.hDel(key, field);
    }

    async del(key: string) {
        return await this.client.del(key);
    }

    async hkeys(key: string) {
        return await this.client.hKeys(key);
    }

    async hgetall(key: string) {
        return await this.client.hGetAll(key);
    }

    async expire(key: string, seconds: number) {
        return await this.client.expire(key, seconds);
    }

    async setEx(key: string, seconds: number, value: string) {
        return await this.client.setEx(key, seconds, value);
    }

    async exists(key: string) {
        return await this.client.exists(key);
    }

    async setNX(key: string, value: string) {
        return await this.client.setNX(key, value);
    }

}

const redisClient = new RedisClient();

export default redisClient;
