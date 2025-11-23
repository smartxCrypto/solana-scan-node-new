import { SubscribeUpdateBlock } from "@triton-one/yellowstone-grpc";
import redisClient from "@/constant/config/redis";

export class BlockDataSerializer {
    public static cache_key = "block_data_cache";
    static serialize(blockData: SubscribeUpdateBlock): string {
        return JSON.stringify(blockData, this.replacer);
    }


    static deserialize(serializedData: string): SubscribeUpdateBlock {
        return JSON.parse(serializedData, this.reviver);
    }


    private static replacer(key: string, value: any): any {
        if (Buffer.isBuffer(value)) {
            return {
                type: 'Buffer',
                data: Array.from(value)
            };
        }

        // 处理 Uint8Array
        if (value instanceof Uint8Array) {
            return {
                type: 'Uint8Array',
                data: Array.from(value)
            };
        }

        // 处理 BigInt
        if (typeof value === 'bigint') {
            return {
                type: 'BigInt',
                value: value.toString()
            };
        }

        return value;
    }


    private static reviver(key: string, value: any): any {
        if (value && typeof value === 'object' && value.type) {
            switch (value.type) {
                case 'Buffer':
                    // 确保恢复为 Buffer 类型
                    return Buffer.from(value.data);
                case 'Uint8Array':
                    return new Uint8Array(value.data);
                case 'BigInt':
                    return BigInt(value.value);
                default:
                    return value;
            }
        }
        return value;
    }


    static async storeBlockDataToRedis(
        blockData: SubscribeUpdateBlock,
        blockNumber: number,
        ttl: number = 3600
    ): Promise<boolean> {
        try {
            const serialized = this.serialize(blockData);
            const key = "block_data_cache";

            // if (ttl > 0) {
            //     await redisClient.hSet(key, String(blockNumber), serialized);
            // } else {
            //     await redisClient.set(key, serialized);
            // }
            await redisClient.hset(BlockDataSerializer.cache_key, String(blockNumber), serialized);
            return true;
        } catch (error) {
            return false;
        }
    }


    static async getBlockDataFromRedis(blockNumber: number): Promise<SubscribeUpdateBlock | null> {
        try {

            const serialized = await redisClient.hget(BlockDataSerializer.cache_key,String(blockNumber));

            if (!serialized) {
                return null;
            }

            const blockData = this.deserialize(serialized);
            return blockData;
        } catch (error) {
            return null;
        }
    }


    static validateSerialization(blockData: SubscribeUpdateBlock): boolean {
        try {
            const serialized = this.serialize(blockData);
            const deserialized = this.deserialize(serialized);

            // 使用相同的 replacer 进行比较，避免 BigInt 序列化问题
            const originalStr = JSON.stringify(blockData, this.replacer);
            const deserializedStr = JSON.stringify(deserialized, this.replacer);

            return originalStr === deserializedStr;
        } catch (error) {
            return false;
        }
    }

}