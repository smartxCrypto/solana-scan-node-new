## 背景

需要对用户本身的数据进行分析 并且给出一份相对标准和客观的数据报告

但是因为牵扯到的周期较长 所以如果对7D以上的用户数据进行全量交易数据计算
所牵扯到的计算资源较大且计算时间较长

核心是基于这个背景 开发一套对用户的资产和收益以时间节点进行快照的方式
并且后续的计算依照快照数据进行计算进行开发的一套算法

## 需进行计算的值

### UserProtocol

时间维度 ： 1d、3d、7d、1M、3M

Realized PnL :已实现收益

UnRealized Pnl:未实现收益

WinRate:胜率

Transactios:买卖次数 和买卖金额

Avg Buy Size: 平均购买金额，每次购买单元的下单平均值

### Protfolio

Token : 代币元数据

Balance:代币余额

Realized Pnl:已实现收益

Unrealized Pnl:未实现收益

Bought:买入总数量 金额

### 计算方式 算法设计

已知 用户的已实现收益是累加的 未实现收益是浮动的
并且未实现收益不会被包含在已实现收益内
已实现收益是用户在卖出时间点的浮动收益率的单位token数量的价格快照

所以已实现收益只有在当用户进行一次卖出操作的时候 才会进行重新计算

所有价格都以u本位价格进行计价 并需同时记录sol本位的价格换算

sol_usd_price: 监控usdc-sol的可信池 当出现usdc 和 sol 的兑换时
记录下兑换比例视为新sol的价格

```tsx
单次买卖的收益：当前价格/买入价格 - 1 * 用户卖出的token数量

单次买卖的收益率：当前价格/买入价格

已实现收益：Pre已实现收益 + 单次买卖的收益

已实现收益率：卖出平均价 / 买入平均价

卖出加权平均价：（Pre卖出总价值 + 当次卖出价值）/ (Pre卖出数量 + 当次买入数量）

买入加权平均价：（Pre买入总花费 + 当次买入花费） / （Pre买入总数量 + 当次买入总数量）
```

未实现收益的本质就是当前持仓部分的收益

```tsx
当前持仓部分的收益 = （token当前价格 - 买入加权平均价） / 当前持仓总数量

当前持仓部分的收益率 = （token当前价格 / 卖出加权平均价）
```

因为收到转账关系的影响 对于转入部分不进行考虑
我们需要考虑的部分在第一个版本仅将转账部分的余额纳入用户当前余额的部分
不纳入用户当前的pnl计算中

常量定义

```tsx
PTP(Per Timezone Profit):单个时间窗口内的收益
PTPR(Per Timezone Profit Rate):单个时间窗口内的收益率
```

由此可知

```tsx
PTP = 用户当前时间窗口的账户交易总价值 -
  用户上一个时间窗口结束时的账户交易总价值;

账户交易总价值 = 用户交易sol数量 + 用户仓位价值;

用户仓位价值 = 用户交易token数量 * 当前token价格;

PTPR = 用户当前时间窗口的账户交易总价值 /
  用户上一个时间窗口结束时的账户交易总价值;
```

根据这个公式又可以得知

```tsx
PnL:  仓位总价格 / 仓位总成本

仓位总价格 = 已经卖出sol + 当前持仓部分的token * 当前token价格

仓位总成本 = 购入token花费的u本位价格 + 已经购入部分的u本位价格

7Day_PnL =（七天内仓位总价格/七天内仓位总成本）

七天前仓位快照 = 七天前持有token u本位总价格 + 七天内买入u本位的花费

当前仓位快照 = 当前token U本位价格 + 七天内卖出U本位的数量

七天前持有的token U本位价格 = 七天前最后一次快照的currentTokenValue的token * 七天前最后一次token价格快照的u本位价格

当前token U本位价格 = 当前的currentTokenValue的U本位总和

七天内买入U本位花费 =  当前totalBuyUsdAmount - 七天前totalBuyUsdAmount 
七天内卖出的U本位的花费 = 当前totalSellUsdAmount - 七天内totalSellUsdAmount
```

为了突出数据的灵活性 不能所有的数据都完全依赖于快照 必须还要有一部分实时的数据

所以用户真实pnl应该永远大于所选择时间的一个时间区间快照的

比如：快照时间区间是每15分钟进行一次快照
并且在每个小时的0，15，30，45分处进行一次快照

用户在2025-06-17 11：13进行了一次pnl的七日查询

那么快照数据就应该是 2025-06-10 11:13前的最后一次快照数据
假设用户在当天的10:42进行了一笔交易 用户就会在06-10 10:45 存在一次快照数据

当前的快照数据就是用户最近一次的交易快照到用户发起pnl查询的时间段中的交易进行一次加权快照计算

以这两次快照数据进行参考计算pnl

由此可知 用户的数据一定永远都是至少大于用户当前一天的数据的快照进行计算的

## 快照

快照的目的是为了最方便的获取到当前用户的信息

### 快照的方式

快照是取从上一个快照时间的区块高度到当前区块高度的所有交易

并对所有涉及到的交易用户进行计算 最后得到这样的数据结构

> 用户当前持仓的计算规则：用户的 totalSellAmount/totalBuyAmount>0.99
> 则视为用户已清仓 会将该数据从currentTokenValue中去除

> winCount和loseCount都只根据已经清仓的代币进行计算

```tsx
interface SnapShotForWalletTrading {
  walletAddress: string;
  snapshotTime: number;
  perTLTradingValue: {
    tokenAddress: string;
    tradeAmount: number;
    tokenPrice: number;
    tokenUsdPrice: number;
    tradeSolAmount: number;
    tradeUsdAmount: number;
    isBuy: boolean;
  }[];
  totalBuySolAmount: number;
  totalBuyUsdAmount: number;
  totalSellSolAmount: number;
  totalSellUsdAmount: number;
  buy_count: number;
  sell_count: number;
  solPrice: number;
  winCount: number;
  loseCount: number;
  currentTokenValue: {
    tokenAddress: string;
    tokenBalance: number;
    tokenWeightBuyPrice: number;
    tokenWeightBuyUsdPrice: number;
    tokenWeightSellPrice: number;
    tokenWeightSellUsdPrice: number;
    tokenSolPrice: number;
    tokenUsdPrice: number;
    totalBuyAmount: number;
    totalSellAmount: number;
    transactions: number;
  }[];
}
```
