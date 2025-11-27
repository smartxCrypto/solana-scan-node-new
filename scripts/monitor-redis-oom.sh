#!/bin/bash

# Redis OOM 监控脚本

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CLI="$REDIS_CLI -a $REDIS_PASSWORD"
fi

echo "=================================================="
echo "  Redis OOM 监控报告"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="
echo ""

# 1. 内存使用情况
echo "💾 内存使用:"
$REDIS_CLI INFO memory | grep -E "used_memory_human|used_memory_peak_human|maxmemory_human|maxmemory_policy|mem_fragmentation_ratio"
echo ""

# 2. Stream 长度
echo "📊 Stream 状态:"
STREAM_LEN=$($REDIS_CLI XLEN block_data_stream)
echo "   Stream 长度: $STREAM_LEN"

if [ "$STREAM_LEN" -gt 5000 ]; then
    echo "   ⚠️  警告: Stream 长度过大 (>5000)"
    echo "   建议: 增加消费者进程数或检查消费者状态"
elif [ "$STREAM_LEN" -gt 10000 ]; then
    echo "   🔴 严重: Stream 长度非常大 (>10000)"
    echo "   建议: 立即增加消费者或手动清理"
fi
echo ""

# 3. Pending 消息
echo "⏳ Pending 消息:"
$REDIS_CLI XPENDING block_data_stream block_processor_group | head -3
echo ""

# 4. 消费者状态
echo "👥 消费者状态:"
CONSUMER_COUNT=$($REDIS_CLI XINFO CONSUMERS block_data_stream block_processor_group | grep -c "name")
echo "   活跃消费者数: $CONSUMER_COUNT"

if [ "$CONSUMER_COUNT" -lt 5 ]; then
    echo "   ⚠️  建议增加消费者进程数"
fi
echo ""

# 5. 其他大键
echo "🔑 TOP 10 大键:"
$REDIS_CLI --bigkeys --i 0.01 2>/dev/null | grep "Biggest" | head -10
echo ""

# 6. 告警检查
echo "🚨 告警检查:"
USED_MEMORY=$($REDIS_CLI INFO memory | grep "used_memory:" | cut -d: -f2 | tr -d '\r')
MAX_MEMORY=$($REDIS_CLI CONFIG GET maxmemory | tail -1)

if [ "$MAX_MEMORY" != "0" ]; then
    USAGE_PERCENT=$((USED_MEMORY * 100 / MAX_MEMORY))
    echo "   内存使用率: ${USAGE_PERCENT}%"
    
    if [ "$USAGE_PERCENT" -gt 90 ]; then
        echo "   🔴 严重: 内存使用超过 90%!"
        echo "   建议: 立即增加 maxmemory 或清理数据"
    elif [ "$USAGE_PERCENT" -gt 80 ]; then
        echo "   ⚠️  警告: 内存使用超过 80%"
    else
        echo "   ✅ 正常"
    fi
fi
echo ""

echo "=================================================="
echo "监控完成"
echo "=================================================="








