import { SubscribeUpdateBlock } from "@triton-one/yellowstone-grpc";
import redisClient from "@/constant/config/redis";

export class BlockDataSerializer {
    // Legacy: Hash 存储方式（保留用于向后兼容）
    public static cache_key = "block_data_cache";
    
    // Redis Stream 配置
    public static stream_key = "block_data_stream";
    public static consumer_group = "block_processor_group";
    public static stream_max_len = 10000;
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


    static async initConsumerGroup(): Promise<void> {
        try {
            await redisClient.xGroupCreate(
                this.stream_key,
                this.consumer_group,
                '$',
                { MKSTREAM: true }
            );
            console.log(`✅ Consumer group '${this.consumer_group}' created`);
        } catch (error: any) {
            const errorMessage = error.message || String(error);
            
            // 消费者组已存在，这是正常情况
            if (errorMessage.includes('BUSYGROUP')) {
                console.log(`ℹ️  Consumer group '${this.consumer_group}' already exists`);
                return;
            }
            
            // Redis OOM 错误 - 如果消费者组已存在，可以继续运行
            if (errorMessage.includes('OOM') || errorMessage.includes('maxmemory')) {
                console.warn(`⚠️  Redis OOM detected, checking if consumer group exists...`);
                
                // 尝试检查消费者组是否存在
                try {
                    const groups = await redisClient.xInfoGroups(this.stream_key);
                    const groupExists = groups?.some((g: any) => g.name === this.consumer_group);
                    
                    if (groupExists) {
                        console.log(`ℹ️  Consumer group exists despite OOM, continuing...`);
                        return;
                    } else {
                        console.error(`❌ Redis OOM and consumer group does not exist, cannot continue`);
                        throw new Error(`Redis OOM: Cannot create consumer group and group does not exist`);
                    }
                } catch (checkError) {
                    // 如果检查也失败，可能是 Stream 不存在
                    console.error(`❌ Failed to check consumer group:`, checkError);
                    throw new Error(`Redis OOM: Cannot verify consumer group status`);
                }
            }
            
            // 其他错误，抛出
            console.error(`❌ Failed to create consumer group:`, error);
            throw error;
        }
    }

    static async storeBlockDataToStream(
        blockData: SubscribeUpdateBlock,
        blockNumber: number
    ): Promise<string | null> {
        try {
            const serialized = this.serialize(blockData);
            
            const messageId = await redisClient.xAdd(
                this.stream_key,
                '*',
                {
                    blockNumber: String(blockNumber),
                    blockData: serialized,
                    timestamp: String(Date.now())
                },
                {
                    TRIM: {
                        strategy: 'MAXLEN',
                        strategyModifier: '~',
                        threshold: this.stream_max_len
                    }
                }
            );
            
            return messageId;
        } catch (error) {
            console.error(`❌ Failed to add block ${blockNumber} to stream:`, error);
            return null;
        }
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

    static async getStreamInfo(): Promise<any> {
        try {
            return await redisClient.xInfoStream(this.stream_key);
        } catch (error) {
            console.error(`❌ Failed to get stream info:`, error);
            return null;
        }
    }

    static async getGroupInfo(): Promise<any> {
        try {
            return await redisClient.xInfoGroups(this.stream_key);
        } catch (error) {
            console.error(`❌ Failed to get group info:`, error);
            return null;
        }
    }

    static async getPendingStats(): Promise<any> {
        try {
            return await redisClient.xPending(this.stream_key, this.consumer_group);
        } catch (error) {
            console.error(`❌ Failed to get pending stats:`, error);
            return null;
        }
    }

}