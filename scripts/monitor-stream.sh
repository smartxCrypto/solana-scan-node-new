#!/bin/bash

# Redis Stream 监控脚本
# 用于监控 block_data_stream 的健康状态

REDIS_CLI="redis-cli"
STREAM_KEY="block_data_stream"
GROUP_NAME="block_processor_group"

echo "=================================================="
echo "  Redis Stream 监控报告"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="
echo ""

# 1. Stream 长度
echo "📊 Stream 长度:"
STREAM_LEN=$($REDIS_CLI XLEN $STREAM_KEY)
echo "   当前消息数: $STREAM_LEN"

if [ "$STREAM_LEN" -gt 1000 ]; then
    echo "   ⚠️  警告: Stream 积压过多 (>1000)"
elif [ "$STREAM_LEN" -gt 100 ]; then
    echo "   ⚠️  注意: Stream 有一定积压 (>100)"
else
    echo "   ✅ 正常"
fi
echo ""

# 2. Pending 消息
echo "⏳ Pending 消息:"
PENDING_INFO=$($REDIS_CLI XPENDING $STREAM_KEY $GROUP_NAME)
if [ -n "$PENDING_INFO" ]; then
    echo "$PENDING_INFO" | while IFS= read -r line; do
        echo "   $line"
    done
    
    # 提取 pending 数量（第一行第一个数字）
    PENDING_COUNT=$(echo "$PENDING_INFO" | head -1 | awk '{print $1}')
    if [ "$PENDING_COUNT" -gt 100 ]; then
        echo "   ⚠️  警告: Pending 消息过多 ($PENDING_COUNT > 100)"
    elif [ "$PENDING_COUNT" -gt 10 ]; then
        echo "   ⚠️  注意: Pending 消息较多 ($PENDING_COUNT > 10)"
    else
        echo "   ✅ 正常"
    fi
else
    echo "   无 Pending 消息"
fi
echo ""

# 3. 消费者组信息
echo "👥 消费者组信息:"
$REDIS_CLI XINFO GROUPS $STREAM_KEY 2>/dev/null | while IFS= read -r line; do
    echo "   $line"
done
echo ""

# 4. 消费者信息
echo "🔧 消费者状态:"
CONSUMERS=$($REDIS_CLI XINFO CONSUMERS $STREAM_KEY $GROUP_NAME 2>/dev/null)
if [ -n "$CONSUMERS" ]; then
    echo "$CONSUMERS" | grep -E "name|pending|idle" | while IFS= read -r line; do
        echo "   $line"
    done
else
    echo "   无活跃消费者"
fi
echo ""

# 5. Redis 内存使用
echo "💾 Redis 内存:"
MEMORY_INFO=$($REDIS_CLI INFO memory | grep "used_memory_human:")
echo "   $MEMORY_INFO"
echo ""

echo "=================================================="
echo "监控完成"
echo "=================================================="

