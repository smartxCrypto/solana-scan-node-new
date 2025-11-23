## 背景

为了对k线图更好的展示 以及token本身的指标分析 需要对每个区块中产出的token数据进行记录

## token数据结构设计

```tsx
interface TokenNormSnapShot{
	blockHeight: number // 区块高度
	blockTime: string // 区块时间
	tokenAddress: string // 代币地址
	buyAmount: number // 购买数量
	sellAmount: number //售出数量
	buyCount: number // 购买笔数
	sellCount: number // 售出笔数
	highPrice: number // 最高价格
	lowPrice: number // 最低价格
	startPrice: number //开盘价格
	endPrice:number //收盘价格
	avgPrice: number //平均价格
	poolAddress:string //池子地址
	snapShotBlockTime:number //此次快照包含的区块时间跨度
}
```

### token表数据处理

根据x*y = k 的公式推理出token_price的价格

> token_price ：trade_token_amount / trade_sol_amount
> 

> token_usd_price: token_price * sol_usd_price
> 

这个数据在每个时间区间都会被记录一次，记录当前区间中所产生的所有交易并以 tokenAddress+poolAddress 作为主键的方式进行记录

buyAmount , sellAmount, buyCount,sellCount 皆为这个区间中的累加数据

当startPrice为0时 第一笔交易的价格视为startPrice

endPrice实时更新 每出现一笔新的交易时就更新这个值

highPrice取最高价格

lowPrice取除0外最低价格

avgPrice = (currentPrice + pre_avgPrice) /2 不需要加权平均

snapShotBlockTime代表从上一次快照到当前快照的时间
