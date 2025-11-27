#!/bin/bash

# 快速查看 Redis Stream 队列状态
# 使用方式: ./scripts/check-stream.sh

# 从环境变量读取 Redis 配置
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_USERNAME="${REDIS_USERNAME:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# 构建 redis-cli 命令
if [ -n "$REDIS_USERNAME" ] && [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT --user $REDIS_USERNAME --pass $REDIS_PASSWORD"
elif [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD"
else
    REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
fi

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Redis Stream 队列状态${NC}"
echo -e "${BLUE}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 1. Stream 长度
echo -e "${GREEN}📊 Stream 长度:${NC}"
STREAM_LEN=$($REDIS_CLI XLEN block_data_stream 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   block_data_stream: $STREAM_LEN 条消息"
    
    # 状态判断
    if [ "$STREAM_LEN" -gt 10000 ]; then
        echo -e "   ${RED}🔴 严重积压 (>10000)${NC}"
    elif [ "$STREAM_LEN" -gt 5000 ]; then
        echo -e "   ${YELLOW}⚠️  警告: 积压较多 (>5000)${NC}"
    elif [ "$STREAM_LEN" -gt 1000 ]; then
        echo -e "   ${YELLOW}⚠️  注意: 有一定积压 (>1000)${NC}"
    else
        echo -e "   ${GREEN}✅ 正常${NC}"
    fi
else
    echo -e "   ${RED}❌ 无法连接到 Redis${NC}"
    exit 1
fi
echo ""

# 2. 消费者组信息
echo -e "${GREEN}👥 消费者组:${NC}"
GROUP_INFO=$($REDIS_CLI XINFO GROUPS block_data_stream 2>/dev/null)
if [ -n "$GROUP_INFO" ]; then
    echo "$GROUP_INFO" | grep -E "name|consumers|pending|last-delivered-id" | sed 's/^/   /'
else
    echo -e "   ${YELLOW}⚠️  消费者组不存在或无法访问${NC}"
fi
echo ""

# 3. Pending 消息统计
echo -e "${GREEN}⏳ Pending 消息:${NC}"
PENDING_INFO=$($REDIS_CLI XPENDING block_data_stream block_processor_group 2>/dev/null)
if [ -n "$PENDING_INFO" ]; then
    echo "$PENDING_INFO" | sed 's/^/   /'
    
    # 提取 pending 数量
    PENDING_COUNT=$(echo "$PENDING_INFO" | head -1 | awk '{print $1}')
    if [ -n "$PENDING_COUNT" ] && [ "$PENDING_COUNT" -gt 0 ]; then
        if [ "$PENDING_COUNT" -gt 100 ]; then
            echo -e "   ${RED}🔴 Pending 过多 (>100)${NC}"
        elif [ "$PENDING_COUNT" -gt 10 ]; then
            echo -e "   ${YELLOW}⚠️  Pending 较多 (>10)${NC}"
        fi
    fi
else
    echo "   无 Pending 消息"
fi
echo ""

# 4. 消费者详情
echo -e "${GREEN}🔧 活跃消费者:${NC}"
CONSUMERS=$($REDIS_CLI XINFO CONSUMERS block_data_stream block_processor_group 2>/dev/null)
if [ -n "$CONSUMERS" ]; then
    CONSUMER_COUNT=$(echo "$CONSUMERS" | grep -c "name")
    echo "   消费者数量: $CONSUMER_COUNT"
    
    # 显示每个消费者的状态
    echo "$CONSUMERS" | grep -E "name|pending|idle" | sed 's/^/   /'
    
    # 状态判断
    if [ "$CONSUMER_COUNT" -lt 3 ]; then
        echo -e "   ${YELLOW}⚠️  消费者数量较少，建议增加${NC}"
    elif [ "$CONSUMER_COUNT" -ge 10 ]; then
        echo -e "   ${GREEN}✅ 消费者数量充足${NC}"
    fi
else
    echo -e "   ${RED}❌ 无活跃消费者${NC}"
fi
echo ""

# 5. Stream 信息
echo -e "${GREEN}📈 Stream 详情:${NC}"
STREAM_INFO=$($REDIS_CLI XINFO STREAM block_data_stream 2>/dev/null)
if [ -n "$STREAM_INFO" ]; then
    echo "$STREAM_INFO" | grep -E "length|first-entry|last-entry" | sed 's/^/   /'
fi
echo ""

# 6. 内存使用（简要）
echo -e "${GREEN}💾 内存使用:${NC}"
MEMORY_INFO=$($REDIS_CLI INFO memory 2>/dev/null | grep -E "used_memory_human|maxmemory_human")
if [ -n "$MEMORY_INFO" ]; then
    echo "$MEMORY_INFO" | sed 's/^/   /'
else
    echo "   无法获取内存信息"
fi
echo ""

# 7. 计算处理速度
echo -e "${GREEN}⚡ 实时速率:${NC}"
STREAM_LEN_START=$STREAM_LEN
sleep 2
STREAM_LEN_END=$($REDIS_CLI XLEN block_data_stream 2>/dev/null)

if [ -n "$STREAM_LEN_END" ]; then
    DIFF=$((STREAM_LEN_END - STREAM_LEN_START))
    
    if [ $DIFF -gt 0 ]; then
        RATE=$(echo "scale=2; $DIFF / 2" | bc)
        echo -e "   生产速度: ${YELLOW}+${RATE} 条/秒${NC} (队列增长)"
    elif [ $DIFF -lt 0 ]; then
        RATE=$(echo "scale=2; -$DIFF / 2" | bc)
        echo -e "   消费速度: ${GREEN}-${RATE} 条/秒${NC} (队列减少)"
    else
        echo -e "   速度: ${GREEN}平衡${NC} (生产=消费)"
    fi
    
    # 预估清空时间
    if [ $DIFF -lt 0 ] && [ "$STREAM_LEN_END" -gt 0 ]; then
        CLEAR_TIME=$(echo "scale=0; $STREAM_LEN_END / (-$DIFF / 2)" | bc)
        CLEAR_MIN=$((CLEAR_TIME / 60))
        CLEAR_SEC=$((CLEAR_TIME % 60))
        echo "   预计清空时间: ${CLEAR_MIN}分${CLEAR_SEC}秒"
    fi
fi
echo ""

# 8. 快速建议
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}💡 快速建议:${NC}"
echo -e "${BLUE}========================================${NC}"

if [ "$STREAM_LEN" -gt 5000 ]; then
    echo -e "1. ${YELLOW}增加消费者进程数:${NC}"
    echo "   pm2 scale consumer +5"
    echo ""
fi

if [ -n "$PENDING_COUNT" ] && [ "$PENDING_COUNT" -gt 50 ]; then
    echo -e "2. ${YELLOW}检查消费者日志:${NC}"
    echo "   pm2 logs consumer --lines 50"
    echo ""
fi

if [ "$STREAM_LEN" -gt 10000 ]; then
    echo -e "3. ${RED}紧急: 手动清理队列:${NC}"
    echo "   redis-cli XTRIM block_data_stream MAXLEN 5000"
    echo ""
fi

echo -e "${BLUE}========================================${NC}\n"








