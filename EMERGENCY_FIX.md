# Redis Stream 架构紧急修复指南

## 🔴 严重问题汇总

### 问题 1: xPending 参数类型错误
**错误信息**: `"arguments[5]" must be of type "string | Buffer", got number instead`

**原因**: count 参数传递的是 number，但 Redis 命令需要 string

**修复**: 已在 `src/constant/config/redis.ts` 中修复
```typescript
const rangeOptions: string[] = [start, end, String(count)]; // 转换为字符串
```

---

### 问题 2: Redis OOM (内存溢出) ⚠️ 最严重
**错误信息**: `OOM command not allowed when used memory > 'maxmemory'`

**原因**:
1. Redis Stream 积压大量数据
2. maxmemory 限制过小
3. 生产速度 > 消费速度

**立即行动步骤**:

#### 步骤 1: 连接 Redis 并检查状态

```bash
# 使用项目中的登录脚本
./login-redis.sh

# 或者直接连接
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD
```

#### 步骤 2: 紧急清理内存

```bash
# 1. 查看当前 Stream 长度
XLEN block_data_stream

# 2. 查看内存使用
INFO memory

# 3. 手动修剪 Stream（保留最近 1000 条）
XTRIM block_data_stream MAXLEN 1000

# 4. 增加内存限制（临时）
CONFIG SET maxmemory 10gb

# 5. 设置驱逐策略
CONFIG SET maxmemory-policy allkeys-lru
```

#### 步骤 3: 停止生产者，只运行消费者

```bash
# 停止生产者（避免继续积压）
pm2 stop scanner

# 检查消费者状态
pm2 list

# 如果消费者不够，增加数量
pm2 scale consumer 10

# 查看消费者日志
pm2 logs consumer --lines 100
```

#### 步骤 4: 等待队列清空

```bash
# 持续监控（每5秒刷新）
watch -n 5 'redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD XLEN block_data_stream'

# 当 Stream 长度 < 100 时，重启生产者
pm2 start scanner
```

---

## 🛠️ 代码修复清单

### ✅ 已修复
1. **xPending 参数类型错误** - redis.ts 已更新

### ⏳ 需要立即修复

#### 修复 2: 减小 Stream 保留长度

编辑 `src/scan/BlockDataSerializer.ts`:

```typescript
export class BlockDataSerializer {
    // 从 10000 减少到 3000，降低内存占用
    public static stream_max_len = 3000; // 改为 3000
}
```

#### 修复 3: 生产者添加错误处理和延迟

编辑 `src/scan/SolanaBlockScanner.ts`:

```typescript
private async processBlockWithGrpc(): Promise<void> {
    // ... 现有代码 ...
    
    await subscribe(config, this.subscriptionRequest, async (res) => {
        const blockData = res.block;
        console.log(`${i} ---> receive slot:${res.block?.slot}`);
        
        if (!blockData) {
            return;
        }

        const handleStart = Date.now();
        
        try {
            // 检查 Stream 长度，如果过大则等待
            const streamLen = await redisClient.xLen(BlockDataSerializer.stream_key);
            if (streamLen > 5000) {
                console.warn(`⚠️  Stream 过长 (${streamLen}), 暂停生产 5 秒...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            const messageId = await BlockDataSerializer.storeBlockDataToStream(
                blockData, 
                Number(res.block?.slot)
            );
            
            if (messageId) {
                console.log(`✅ Slot ${res.block?.slot} stored (${Date.now() - handleStart} ms)`);
            } else {
                console.error(`❌ Failed to store slot ${res.block?.slot}`);
                // OOM 时等待更长时间
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        } catch (error: any) {
            console.error(`❌ Error storing block:`, error?.message);
            if (error?.message?.includes('OOM')) {
                console.error(`🔴 Redis OOM! 暂停 30 秒...`);
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        }
        
        i++;
    }, async (error) => {
        console.error(error);
    });
}
```

---

## 📊 监控脚本使用

项目中有多个监控脚本可用：

### 1. 快速检查 Stream 状态
```bash
./scripts/check-stream.sh
```

### 2. 详细 Stream 监控
```bash
./scripts/monitor-stream.sh
```

### 3. OOM 专项监控
```bash
./scripts/monitor-redis-oom.sh
```

### 4. 持续监控（每 10 秒刷新）
```bash
watch -n 10 './scripts/check-stream.sh'
```

---

## 🔍 诊断命令速查

```bash
# Redis 连接
./login-redis.sh

# 查看 Stream 长度
XLEN block_data_stream

# 查看 Pending 消息
XPENDING block_data_stream block_processor_group

# 查看消费者
XINFO CONSUMERS block_data_stream block_processor_group

# 查看内存
INFO memory

# 查看最新消息
XREVRANGE block_data_stream + - COUNT 5

# 查看最老消息
XRANGE block_data_stream - + COUNT 5
```

---

## 🎯 最佳实践建议

### 短期（立即执行）
1. ✅ 修复 xPending 类型错误（已完成）
2. ⚠️ 紧急清理 Redis 内存
3. ⚠️ 增加 maxmemory 到 10GB
4. ⚠️ 临时停止生产者
5. ⚠️ 增加消费者到 10 个

### 中期（今天完成）
1. 减小 stream_max_len 到 3000
2. 添加生产者背压机制
3. 优化消费者处理逻辑
4. 实施持续监控

### 长期（本周完成）
1. 数据压缩
2. 分级处理（简单区块快速通道）
3. 降级策略（OOM 时自动降速）
4. 告警系统集成

---

## 🚨 故障响应流程

```
1. 收到 OOM 告警
   ↓
2. 停止生产者 (pm2 stop scanner)
   ↓
3. 连接 Redis，执行 XTRIM
   ↓
4. 增加 maxmemory
   ↓
5. 检查消费者数量
   ↓
6. 等待 Stream 长度 < 100
   ↓
7. 重启生产者 (pm2 start scanner)
   ↓
8. 持续监控 30 分钟
```

---

**更新时间**: 2025-11-25
**状态**: 🔴 需要立即处理
**优先级**: P0 - 最高








