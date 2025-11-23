# Pump Fun 交易解析器使用指南

## 概述

本项目提供了一套完整的 Solana Pump Fun 交易解析工具，能够从交易日志中提取代币创建信息，包括代币名称、符号、图片链接等元数据。

## 文件结构

```
src/collection/transactions/pumpfun/
├── idl/
│   ├── pump-fun.ts           # 真实的 Pump Fun IDL 定义
│   └── pumpfun.json         # 原始 IDL JSON 文件
├── final_parser.ts          # 最终版本的解析器（推荐使用）
├── simple_demo.ts           # 简化版演示
├── improved_parser.ts       # 改进版解析器
├── demo.ts                  # 基础演示
└── shyft.ts                # Shyft SDK 集成（可选）
```

## 核心功能

### ✅ 已实现功能

1. **交易识别**：自动识别 Pump Fun 程序交易
2. **指令解析**：区分创建、购买、出售指令
3. **代币信息提取**：从 Program data 中解析代币元数据
4. **结构化输出**：生成标准化的代币信息对象
5. **批量处理**：支持处理多个交易

### 📊 提取的信息

- 🏷️ 代币地址
- 📛 代币名称  
- 🔤 代币符号
- 🔢 小数位数
- 📊 总供应量
- 🖼️ 图片链接
- 🏛️ 发行平台
- 💰 交易费用
- ⚡ 计算单元消耗

## 快速开始

### 1. 基础使用

```typescript
import { createFinalTokenInfo } from "./final_parser.ts";

// 你的交易数据
const transactionData = {
    meta: {
        logMessages: [...],
        postTokenBalances: [...],
        // ... 其他字段
    },
    transaction: {
        signatures: [...]
    }
};

// 解析代币信息
const tokenInfo = createFinalTokenInfo(transactionData);

if (tokenInfo) {
    console.log("代币名称:", tokenInfo.name);
    console.log("代币符号:", tokenInfo.symbol);
    console.log("代币地址:", tokenInfo.address);
}
```

### 2. 运行演示

```bash
# 运行最终版本演示
deno run --allow-read src/collection/transactions/pumpfun/final_parser.ts

# 运行简化版演示
deno run --allow-read src/collection/transactions/pumpfun/simple_demo.ts
```

### 3. 测试结果

基于你提供的测试数据，解析器成功提取了以下信息：

```json
{
  "address": "4veK9R9GxmgxqkFhTa2VnE6MJ4YfTxnr92HF5gH5LcAF",
  "name": "cvcostco",
  "symbol": "COSTCOC", 
  "decimals": 6,
  "totalSupply": "873764705.882353",
  "imageUrl": "https://ipfs.io/ipfs/Qmc4Buro7KJ5yP4eVJAcYknkYMmJHiN8HCjE5L2CeKzHGa",
  "platform": "Pump Fun",
  "bondingCurveComplete": false
}
```

## API 参考

### `parseTokenMetadataFinal(base64Data: string)`

从 base64 编码的程序数据中解析代币元数据。

**参数：**
- `base64Data`: 从交易日志 "Program data:" 后提取的 base64 字符串

**返回：**
- 包含 `extracted` 对象的结果，含有 `name`、`symbol`、`imageUrl` 等字段

### `createFinalTokenInfo(transactionData: any): TokenInfo | null`

从完整的交易数据创建标准化的代币信息对象。

**参数：**
- `transactionData`: 完整的 Solana 交易响应对象

**返回：**
- `TokenInfo` 对象或 `null`（如果解析失败）

### `TokenInfo` 接口

```typescript
interface TokenInfo {
    address: string;           // 代币合约地址
    name: string;             // 代币名称
    symbol: string;           // 代币符号
    decimals: number;         // 小数位数
    totalSupply: string;      // 总供应量
    imageUrl: string;         // 图片链接
    platform: string;        // 发行平台
    rawMetadata: string;      // 原始元数据
    bondingCurveComplete: boolean; // 联合曲线是否完成
}
```

## 集成到你的应用

### 1. 实时监控

```typescript
// 监听 Pump Fun 程序交易
const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// 过滤创建交易
function isCreateTransaction(logs: string[]): boolean {
    return logs.some(log => 
        log.includes(PUMP_FUN_PROGRAM_ID) && 
        log.includes("Instruction: Create")
    );
}

// 处理新交易
function processNewTransaction(txData: any) {
    if (isCreateTransaction(txData.meta.logMessages)) {
        const tokenInfo = createFinalTokenInfo(txData);
        if (tokenInfo) {
            // 存储到数据库或进行其他处理
            saveTokenToDatabase(tokenInfo);
        }
    }
}
```

### 2. 批量处理历史数据

```typescript
import { batchProcessPumpFunTransactions } from "./improved_parser.ts";

const historicalTransactions = []; // 你的历史交易数据
const tokens = batchProcessPumpFunTransactions(historicalTransactions);

console.log(`处理了 ${tokens.length} 个代币`);
```

## 解析逻辑

### 1. 元数据解析策略

1. **连接模式识别**：查找 `小写字母+大写字母` 的模式（如 `costcoCOSTCO`）
2. **分词解析**：将可读文本分解为单词并分类
3. **模式匹配**：使用正则表达式识别代币名称和符号
4. **URL 提取**：识别 HTTPS 图片链接

### 2. 数据来源

- **代币地址**：从 `postTokenBalances[0].mint` 获取
- **供应量**：从 `postTokenBalances[0].uiTokenAmount` 获取
- **元数据**：从程序日志中的 "Program data:" 解析
- **交易信息**：从 `meta` 对象获取费用、计算单元等

## 已知限制和改进空间

### 当前限制

1. **元数据解析精度**：复杂的编码格式可能导致解析不完全准确
2. **依赖关系**：Shyft SDK 在某些环境下可能有兼容性问题
3. **错误处理**：需要更完善的错误处理和重试机制

### 改进建议

1. **增强解析算法**：改进正则表达式和模式匹配
2. **添加验证**：通过链上查询验证解析结果
3. **性能优化**：优化批量处理性能
4. **错误恢复**：添加更多的解析策略作为备选方案

## 贡献

欢迎提交问题报告和改进建议！如果你发现了更好的解析策略或遇到了特殊情况，请分享你的发现。

## 许可证

本项目使用 MIT 许可证。

---

**注意**：此解析器是基于对 Pump Fun 交易结构的观察和分析开发的。随着 Pump Fun 协议的更新，可能需要相应调整解析逻辑。 