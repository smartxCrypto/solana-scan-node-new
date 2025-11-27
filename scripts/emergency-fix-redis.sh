#!/bin/bash

# Redis OOM 紧急修复脚本
# 使用方式: ./scripts/emergency-fix-redis.sh

echo "========================================="
echo "🚨 Redis OOM 紧急修复程序"
echo "========================================="
echo ""

# 从环境变量读取
source .env 2>/dev/null || true

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# 构建 redis-cli 命令
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD"
else
    REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
fi

echo "📊 步骤 1/6: 检查当前状态..."
echo "-----------------------------------"
STREAM_LEN=$($REDIS_CLI XLEN block_data_stream 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ 无法连接到 Redis"
    echo "   请检查 Redis 连接信息"
    exit 1
fi

echo "   Stream 长度: $STREAM_LEN"

USED_MEM=$($REDIS_CLI INFO memory | grep "used_memory_human:" | cut -d: -f2 | tr -d '\r')
MAX_MEM=$($REDIS_CLI CONFIG GET maxmemory | tail -1)
echo "   内存使用: $USED_MEM"
echo "   内存限制: $MAX_MEM bytes"
echo ""

echo "🛑 步骤 2/6: 停止生产者..."
echo "-----------------------------------"
pm2 stop scanner 2>/dev/null || echo "   生产者未运行或已停止"
echo "   ✅ 生产者已停止"
echo ""

echo "💾 步骤 3/6: 增加 Redis 内存限制..."
echo "-----------------------------------"
$REDIS_CLI CONFIG SET maxmemory 10gb
echo "   ✅ maxmemory 已设置为 10GB"

$REDIS_CLI CONFIG SET maxmemory-policy allkeys-lru
echo "   ✅ 驱逐策略已设置为 allkeys-lru"
echo ""

echo "✂️  步骤 4/6: 修剪 Stream 数据..."
echo "-----------------------------------"
if [ "$STREAM_LEN" -gt 5000 ]; then
    echo "   Stream 长度 > 5000，执行修剪..."
    $REDIS_CLI XTRIM block_data_stream MAXLEN 1000
    NEW_LEN=$($REDIS_CLI XLEN block_data_stream)
    echo "   ✅ Stream 已修剪: $STREAM_LEN → $NEW_LEN"
else
    echo "   Stream 长度正常，无需修剪"
fi
echo ""

echo "🗑️  步骤 5/6: 清理旧数据..."
echo "-----------------------------------"
$REDIS_CLI DEL block_data_cache 2>/dev/null || true
echo "   ✅ 旧 Hash 缓存已清理"

# 清理旧锁
LOCK_COUNT=$($REDIS_CLI KEYS "handle_block_data_lock:*" | wc -l)
if [ "$LOCK_COUNT" -gt 0 ]; then
    $REDIS_CLI KEYS "handle_block_data_lock:*" | xargs $REDIS_CLI DEL
    echo "   ✅ 已清理 $LOCK_COUNT 个旧锁"
else
    echo "   无旧锁需要清理"
fi
echo ""

echo "👥 步骤 6/6: 检查消费者..."
echo "-----------------------------------"
CONSUMER_COUNT=$($REDIS_CLI XINFO CONSUMERS block_data_stream block_processor_group 2>/dev/null | grep -c "name" || echo "0")
echo "   当前消费者数: $CONSUMER_COUNT"

if [ "$CONSUMER_COUNT" -lt 5 ]; then
    echo "   ⚠️  消费者数量较少"
    echo "   建议执行: pm2 scale consumer 10"
else
    echo "   ✅ 消费者数量充足"
fi
echo ""

echo "========================================="
echo "✅ 紧急修复完成！"
echo "========================================="
echo ""
echo "📋 后续步骤:"
echo "-----------------------------------"
echo "1. 等待 Stream 清空 (监控命令):"
echo "   watch -n 5 'redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD XLEN block_data_stream'"
echo ""
echo "2. Stream < 100 后，重启生产者:"
echo "   pm2 restart scanner"
echo ""
echo "3. 持续监控:"
echo "   ./scripts/check-stream.sh"
echo ""
echo "4. 查看日志:"
echo "   pm2 logs"
echo ""
echo "========================================="








