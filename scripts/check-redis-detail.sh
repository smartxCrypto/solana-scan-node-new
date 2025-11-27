#!/bin/bash

# 检查 Redis Stream 内存使用情况

source /home/ecs-user/data/git/solana-scan-node-new/.env

echo "========================================="
echo "🔍 Redis Stream 内存诊断"
echo "========================================="
echo ""

REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT --user $REDIS_USERNAME -a $REDIS_PASSWORD"

echo "1️⃣  Stream 长度和内存"
echo "-----------------------------------"
STREAM_LEN=$($REDIS_CLI XLEN block_data_stream 2>&1)
echo "Stream 长度: $STREAM_LEN"

echo -e "\n2️⃣  内存使用情况"
echo "-----------------------------------"
$REDIS_CLI INFO memory | grep -E "used_memory_human|maxmemory_human|maxmemory_policy|mem_fragmentation_ratio"

echo -e "\n3️⃣  Pending 消息统计"
echo "-----------------------------------"
$REDIS_CLI XPENDING block_data_stream block_processor_group 2>&1 | head -5

echo -e "\n4️⃣  消费者状态"
echo "-----------------------------------"
CONSUMERS=$($REDIS_CLI XINFO CONSUMERS block_data_stream block_processor_group 2>&1)
CONSUMER_COUNT=$(echo "$CONSUMERS" | grep -c "name" 2>/dev/null || echo "0")
echo "活跃消费者数: $CONSUMER_COUNT"

if [ "$CONSUMER_COUNT" -gt 0 ]; then
    echo -e "\n消费者详情:"
    echo "$CONSUMERS" | grep -E "name|pending|idle" | head -30
fi

echo -e "\n5️⃣  检查大键"
echo "-----------------------------------"
echo "检查 LP_INFO_CACHE_KEY:"
LP_INFO_SIZE=$($REDIS_CLI HLEN LP_INFO_CACHE_KEY 2>&1)
echo "  LP_INFO_CACHE_KEY 大小: $LP_INFO_SIZE"

echo -e "\n检查是否还有旧的 Hash 缓存:"
OLD_CACHE=$($REDIS_CLI HLEN block_data_cache 2>&1)
echo "  block_data_cache 大小: $OLD_CACHE"

echo -e "\n6️⃣  Stream 消息样本"
echo "-----------------------------------"
echo "最新的 3 条消息:"
$REDIS_CLI XREVRANGE block_data_stream + - COUNT 3 2>&1 | head -20

echo -e "\n7️⃣  计算消费速度"
echo "-----------------------------------"
STREAM_LEN_START=$STREAM_LEN
sleep 5
STREAM_LEN_END=$($REDIS_CLI XLEN block_data_stream 2>&1)
DIFF=$((STREAM_LEN_END - STREAM_LEN_START))

echo "5秒前 Stream 长度: $STREAM_LEN_START"
echo "5秒后 Stream 长度: $STREAM_LEN_END"
echo "变化: $DIFF"

if [ "$DIFF" -gt 0 ]; then
    echo "⚠️  队列在增长 (+$DIFF)，生产 > 消费"
elif [ "$DIFF" -lt 0 ]; then
    echo "✅ 队列在减少 ($DIFF)，消费 > 生产"
else
    echo "✅ 队列平衡，生产 = 消费"
fi

echo -e "\n========================================="
echo "💡 分析结果"
echo "========================================="

if [ "$STREAM_LEN" -gt 5000 ]; then
    echo "🔴 严重: Stream 积压 > 5000"
    echo "   原因: 消费速度跟不上生产速度"
    echo "   建议: 增加消费者数量或优化消费逻辑"
elif [ "$STREAM_LEN" -gt 1000 ]; then
    echo "⚠️  警告: Stream 积压 > 1000"
    echo "   建议: 监控消费速度"
else
    echo "✅ 正常: Stream 长度合理"
fi

# 检查内存占用
USED_MEM_BYTES=$($REDIS_CLI INFO memory | grep "used_memory:" | cut -d: -f2 | tr -d '\r')
MAX_MEM_BYTES=$($REDIS_CLI CONFIG GET maxmemory | tail -1)

if [ -n "$USED_MEM_BYTES" ] && [ -n "$MAX_MEM_BYTES" ] && [ "$MAX_MEM_BYTES" != "0" ]; then
    USAGE_PERCENT=$((USED_MEM_BYTES * 100 / MAX_MEM_BYTES))
    echo -e "\n内存使用率: ${USAGE_PERCENT}%"
    
    if [ "$USAGE_PERCENT" -gt 90 ]; then
        echo "🔴 严重: 内存使用 > 90%"
        echo "   立即行动: 增加 maxmemory 或清理数据"
    elif [ "$USAGE_PERCENT" -gt 80 ]; then
        echo "⚠️  警告: 内存使用 > 80%"
    fi
fi

echo -e "\n========================================="








