# 🧠 聪明钱分析系统

## 概述

基于账户地址的智能分析系统，通过分析过去7天的交易数据，计算"聪明钱"指标并进行分类。该系统使用 `wallet_trading_ss` 快照表作为数据源，提供全面的钱包行为分析和智能分类功能。

## 🎯 核心指标

### 基础财务指标
- **native_token_balance**: SOL计价的原生代币总价值
- **wallet_balance**: 账户总资产价值（所有代币折合）

### 交易活跃度指标
- **buy_token_count**: 分析周期内购买的代币种类数量
- **active_days_present**: 分析周期内有交易活动的天数比率（0-1）
- **token_buy_counts**: 分析周期内平均每种代币的购买次数

### 收益相关指标
- **effective_win_token_pct**: 代币胜率 - 计算公式:
  - 满足条件的代币数量 / 总代币数量
  - 条件1: (已实现利润 + 未实现利润) / 买入成本 > 1.1
  - 条件2: (已实现利润 + 未实现利润) > 0.5 SOL

- **profit**: 分析周期内总收益 - 计算公式:
  - 已实现利润 + 未实现利润 - 买入成本

### 时间维度指标
- **weight_hold_time**: 加权代币持有时长(秒)
- **weight_average_time**: 加权代币清仓时长(秒)

## 🏷️ 智能分类标准

### 1. 高胜率组 (HIGH_WIN_RATE)
```
条件1: native_token_balance > 0.5 或 wallet_balance > 1
条件2: profit > 0.025 * TWL (SOL)
条件3: effective_win_token_pct > 0.6
条件4: token_buy_counts > 0.3 * TWL
条件5: active_days_present > 0.3 * TWL
```

### 2. 高收益率组 (HIGH_PROFIT_RATE)
```
条件1: profit > 0.7 * TWL
条件2: effective_win_token_pct > 0.5
条件3: native_token_balance > 0.5 或 wallet_balance > 1
条件4: token_buy_counts > 0.1 * TWL
条件5: active_days_present > 0.3 * TWL
```

### 3. 鲸鱼盈利组 (WHALE_PROFIT)
```
条件1: native_token_balance > 1000 或 wallet_balance > 2000
条件2: effective_win_token_pct > 0.3
条件3: token_buy_counts > 0.1 * TWL
条件4: active_days_present > 0.3 * TWL
```

*注：TWL (Time Window Length) 表示分析窗口天数，默认为1*

## 📁 文件结构

```
src/smart-money/
├── index.ts          # 核心分析系统
├── example.ts        # 使用示例和演示
└── README.md         # 本文档
```

## 🚀 快速开始

### 基本使用

```typescript
import { SmartMoneyAnalyzer, SmartMoneyCategory } from "./src/smart-money/index.ts";

const analyzer = new SmartMoneyAnalyzer();

// 分析单个钱包
const result = await analyzer.analyzeWallet("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
console.log(`分类: ${result.category}`);
console.log(`置信度: ${result.categoryScore}%`);
console.log(`收益: ${result.metrics.profit} SOL`);

// 批量分析钱包
const walletAddresses = [
    "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
];
const batchResults = await analyzer.analyzeWallets(walletAddresses);

// 获取统计信息
const stats = analyzer.getSmartMoneyStats(batchResults);
console.log("分类分布:", stats.byCategory);
console.log("平均指标:", stats.avgMetrics);
```

### 运行示例

```bash
# 运行完整示例
deno run --allow-all src/smart-money/example.ts

# 或直接使用
cd /home/ubuntu/github-soldata
deno run --allow-all src/smart-money/example.ts
```

## 📊 输出示例

### 单个钱包分析结果
```
钱包: 7xKXtg2C...
分类: high_win_rate
置信度: 87.5%
原生代币余额: 12.5478 SOL
总钱包余额: 12.5478 SOL
代币胜率: 75.0%
总收益: 8.2341 SOL
购买代币种类: 15
活跃天数比例: 85.7%
```

### 批量分析统计
```
📊 聪明钱分析统计:
总钱包数: 100

分类分布:
  🎯 高胜率组: 23 (23.0%)
  💰 高收益率组: 8 (8.0%)
  🐋 鲸鱼盈利组: 3 (3.0%)
  📊 普通用户: 66 (66.0%)

平均指标:
  平均代币余额: 2.3456 SOL
  平均钱包余额: 2.3456 SOL
  平均代币胜率: 42.3%
  平均收益: 0.8901 SOL
  平均购买代币种类: 5.2
  平均活跃天数比例: 67.8%
```

## 🔧 高级功能

### 自定义分析时间窗口

```typescript
const analyzer = new SmartMoneyAnalyzer();

// 分析特定时间点前7天的数据
const endTime = Math.floor(new Date('2024-01-01').getTime() / 1000);
const result = await analyzer.analyzeWallet(walletAddress, endTime);
```

### 实时监控集成

```typescript
// 设置定时监控
setInterval(async () => {
    const activeWallets = await getActiveWallets(); // 获取活跃钱包
    const results = await analyzer.analyzeWallets(activeWallets);
    
    const smartMoneyWallets = results.filter(r => 
        r.category !== SmartMoneyCategory.NORMAL
    );
    
    if (smartMoneyWallets.length > 0) {
        console.log(`🚨 发现 ${smartMoneyWallets.length} 个聪明钱钱包!`);
        // 发送警报或执行其他操作
    }
}, 60000); // 每分钟检查一次
```

### 导出分析结果

```typescript
const results = await analyzer.analyzeWallets(walletAddresses);
const stats = analyzer.getSmartMoneyStats(results);

// 导出到JSON文件
const exportData = {
    analysisTime: new Date().toISOString(),
    totalWallets: stats.total,
    categoryDistribution: stats.byCategory,
    avgMetrics: stats.avgMetrics,
    detailedResults: results
};

await Deno.writeTextFile(
    "smart_money_analysis_results.json", 
    JSON.stringify(exportData, null, 2)
);
```

## 🔬 算法原理

### 数据处理流程

1. **获取基准数据**: 分析开始前的最后一次快照作为基准
2. **计算增量变化**: 分析周期内的交易变化
3. **代币持有分析**: 计算每个代币的买入/卖出/持有情况
4. **利润计算**: 区分已实现利润和未实现利润
5. **指标计算**: 基于持有信息计算各项智能指标
6. **分类判断**: 根据阈值条件进行智能分类

### 关键算法

#### 已实现利润计算
```
已实现利润 = 卖出总价值 - (买入总成本 × 卖出比例)
```

#### 未实现利润计算
```
未实现利润 = 当前持有价值 - 剩余持有成本
剩余持有成本 = 买入总成本 × 剩余持有比例
```

#### 加权持有时长
```
加权持有时长 = Σ(持有时间 × 代币数量) / Σ(代币数量)
```

## ⚠️ 注意事项

1. **数据依赖**: 系统依赖 `wallet_trading_ss` 快照表的数据质量
2. **时间精度**: 分析精度受快照频率限制
3. **计算复杂度**: 大批量分析时注意性能优化
4. **分类阈值**: 可根据实际情况调整分类阈值参数

## 🔧 配置选项

系统内置配置可在类初始化时调整：

```typescript
class SmartMoneyAnalyzer {
    private readonly TIME_WINDOW_DAYS = 7;  // 分析窗口天数
    private readonly TWL = 1;               // 时间窗口长度系数
    
    // 可以通过继承类来自定义这些参数
}
```

## 📈 性能优化

- **批量处理**: 使用 `analyzeWallets()` 而非多次调用 `analyzeWallet()`
- **并行处理**: 内置50个钱包一批的并行处理机制
- **缓存机制**: 合理使用快照数据避免重复查询
- **分页查询**: 大量钱包分析时自动分批处理

## 🤝 集成建议

1. **API接口**: 可包装为RESTful API提供外部调用
2. **定时任务**: 结合cron任务进行定期分析
3. **告警系统**: 集成消息推送进行实时告警
4. **数据可视化**: 结合图表库进行结果展示
5. **历史追踪**: 建立历史分析记录表进行趋势分析

## 📞 支持

如需技术支持或功能扩展，请参考：
- 源码注释中的详细说明
- `example.ts` 中的完整使用示例
- 系统日志输出进行问题诊断

---

*该系统为Solana生态聪明钱识别的核心工具，持续优化中...* 