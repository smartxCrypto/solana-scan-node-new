// config/redis

import dotenv from "dotenv";
import { createClient } from "redis";

// 加载环境变量
dotenv.config();

class RedisClient {
    public client: ReturnType<typeof createClient>;

    constructor() {

        const username = process.env.REDIS_USERNAME;
        const password = process.env.REDIS_PASSWORD;
        const host = process.env.REDIS_HOST;
        const port = process.env.REDIS_PORT;

        this.client = createClient({
            url: `redis://${username}:${password}@${host}:${port}/0`
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

    async rpush(key: string, ...values: string[]) {
        return await this.client.rPush(key, values);
    }

    async blpop(key: string, timeout: number) {
        return await this.client.blPop(key, timeout);
    }

    // Redis Stream 相关方法
    async xAdd(
        key: string,
        id: string,
        message: Record<string, string>,
        options?: { TRIM?: { strategy: string; strategyModifier?: string; threshold: number } }
    ) {
        const args: any = { id };
        if (options?.TRIM) {
            args.TRIM = options.TRIM;
        }
        return await this.client.xAdd(key, id, message, args);
    }

    async xReadGroup(
        group: string,
        consumer: string,
        streams: { key: string; id: string }[],
        options?: { COUNT?: number; BLOCK?: number }
    ) {
        const streamKeys = streams.map(s => ({ key: s.key, id: s.id }));
        return await this.client.xReadGroup(group, consumer, streamKeys, options);
    }

    async xAck(key: string, group: string, id: string) {
        return await this.client.xAck(key, group, id);
    }

    async xGroupCreate(key: string, group: string, id: string, options?: { MKSTREAM?: boolean }) {
        return await this.client.xGroupCreate(key, group, id, options);
    }

    async xPending(key: string, group: string, start?: string, end?: string, count?: number, consumer?: string): Promise<any> {
        if (start && end && count !== undefined) {
            const rangeOptions: any = [start, end, String(count)];
            if (consumer) {
                rangeOptions.push(consumer);
            }
            return await this.client.sendCommand(['XPENDING', key, group, ...rangeOptions]);
        }
        return await this.client.xPending(key, group);
    }

    async xClaim(key: string, group: string, consumer: string, minIdleTime: number, ids: string[]) {
        return await this.client.xClaim(key, group, consumer, minIdleTime, ids);
    }

    async xDel(key: string, ...ids: string[]) {
        return await this.client.xDel(key, ids);
    }

    async xRange(key: string, start: string, end: string, count?: number) {
        if (count) {
            return await this.client.xRange(key, start, end, { COUNT: count });
        }
        return await this.client.xRange(key, start, end);
    }

    async xLen(key: string) {
        return await this.client.xLen(key);
    }

    async xInfoStream(key: string) {
        return await this.client.xInfoStream(key);
    }

    async xInfoGroups(key: string) {
        return await this.client.xInfoGroups(key);
    }

    async xInfoConsumers(key: string, group: string) {
        return await this.client.xInfoConsumers(key, group);
    }

    pipeline(): any {
        return this.client.multi();
    }

}

const redisClient = new RedisClient();

export default redisClient;
