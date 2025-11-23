import { ParsedTransactionWithMeta } from "@solana/web3.js";
// import dotenv from "dotenv";
import axios from "axios";
import { assert } from "node:console";
import { readTextFile, writeTextFile, mkdir, stat } from '@/lib/node-utils';
// import { Pool } from "pg";

// dotenv.config();

interface TokenTransfer {
  type: "receive" | "send";
  mint: string;
  toAddress: string | null;
  fromAddress: string | null;
  fromOwner: string | null;
  toOwner: string | null;
  amount: number;
  tokenValue: number;
}

interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  icon_url: string | null;
}

interface TokenPrice {
  mint: string;
  price_usd: number;
  timestamp: number;
}

// 数据文件路径
const TOKEN_METADATA_FILE = './data/token_metadata.json';
const TOKEN_PRICES_FILE = './data/token_prices.json';

// 确保数据目录存在
async function ensureDataDirectory() {
  try {
    await stat('./data');
  } catch {
    await mkdir('./data', { recursive: true });
  }
}

// 读取本地缓存的 token metadata
export async function getTokenMetadataFromCache(mint: string): Promise<any | null> {
  try {
    const data = await readTextFile(TOKEN_METADATA_FILE);
    const metadata = JSON.parse(data);
    return metadata[mint] || null;
  } catch {
    return null;
  }
}

// 保存 token metadata 到本地缓存
export async function saveTokenMetadataToCache(mint: string, metadata: any): Promise<void> {
  await ensureDataDirectory();
  const data = await readTextFile(TOKEN_METADATA_FILE).catch(() => '{}');
  const cache = JSON.parse(data);
  cache[mint] = metadata;
  await writeTextFile(TOKEN_METADATA_FILE, JSON.stringify(cache, null, 2));
}

// 读取本地缓存的 token prices
export async function getTokenPricesFromCache(): Promise<TokenPrice[]> {
  try {
    const data = await readTextFile(TOKEN_PRICES_FILE);
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// 保存 token prices 到本地缓存
export async function saveTokenPricesToCache(prices: TokenPrice[]): Promise<void> {
  await ensureDataDirectory();
  await writeTextFile(TOKEN_PRICES_FILE, JSON.stringify(prices, null, 2));
}

// 从交易中提取代币转移事件
export function extractTokenTransfers(txInfo: ParsedTransactionWithMeta) {
  const transfers: TokenTransfer[] = [];

  // 检查后置处理日志
  if (txInfo.meta && txInfo.meta.postTokenBalances && txInfo.meta.preTokenBalances) {
    const preBalances = txInfo.meta.preTokenBalances;
    const postBalances = txInfo.meta.postTokenBalances;

    // 建立账户索引映射
    const accountMap: { [key: number]: string } = {};
    txInfo.transaction.message.accountKeys.forEach((account, index) => {
      accountMap[index] = account.pubkey.toString();
    });

    // 构建余额变化映射
    const balanceChanges: { [key: string]: { [key: string]: { owner: string | null; mint: string; postAmount: string; preAmount: string; delta: bigint } } } = {};
    const tokenInfoCache: { [key: string]: TokenInfo } = {};

    postBalances.forEach(post => {
      const accountIndex = post.accountIndex;
      const address = accountMap[accountIndex];
      const mint = post.mint;
      const owner = post.owner || null;
      const postAmount = post.uiTokenAmount.amount;

      if (!balanceChanges[address]) {
        balanceChanges[address] = {};
      }

      balanceChanges[address][mint] = {
        owner,
        mint,
        postAmount,
        preAmount: '0',
        delta: BigInt(postAmount)
      };
    });

    preBalances.forEach(pre => {
      const accountIndex = pre.accountIndex;
      const address = accountMap[accountIndex];
      const mint = pre.mint;
      const owner = pre.owner || null;
      const preAmount = pre.uiTokenAmount.amount;

      if (!balanceChanges[address]) {
        balanceChanges[address] = {};
      }

      if (!balanceChanges[address][mint]) {
        balanceChanges[address][mint] = {
          owner,
          mint,
          postAmount: '0',
          preAmount,
          delta: BigInt(0) - BigInt(preAmount)
        };
      } else {
        balanceChanges[address][mint].preAmount = preAmount;
        balanceChanges[address][mint].delta = BigInt(balanceChanges[address][mint].postAmount) - BigInt(preAmount);
      }
    });

    // 识别转移
    for (const [address, mints] of Object.entries(balanceChanges)) {
      for (const [mint, change] of Object.entries(mints)) {
        if (change.delta > 0) {
          // 收到代币
          transfers.push({
            type: 'receive',
            mint,
            toAddress: address,
            toOwner: change.owner,
            amount: Number(change.delta),
            tokenValue: Number(change.delta),
            fromAddress: null,
            fromOwner: null
          });
        } else if (change.delta < 0) {
          // 发送代币
          transfers.push({
            type: 'send',
            mint,
            fromAddress: address,
            fromOwner: change.owner,
            amount: Number(-change.delta),
            tokenValue: Number(-change.delta),
            toAddress: null,
            toOwner: null
          });
        }
      }
    }

    // 匹配发送和接收事件
    const sendEvents = transfers.filter(t => t.type === 'send');
    const receiveEvents = transfers.filter(t => t.type === 'receive');

    const matchedTransfers: TokenTransfer[] = [];

    sendEvents.forEach(send => {
      receiveEvents.forEach(receive => {
        if (send.mint === receive.mint && send.amount === receive.amount) {
          matchedTransfers.push({
            mint: send.mint,
            fromAddress: send.fromAddress,
            fromOwner: send.fromOwner,
            toAddress: receive.toAddress,
            toOwner: receive.toOwner,
            amount: send.amount,
            tokenValue: send.tokenValue,
            type: "send"
          });
        }
      });
    });

    return matchedTransfers;
  }

  return [];
}

// 从缓存或API获取代币信息
const tokenInfoCache: { [key: string]: TokenInfo } = {};

async function getTokenInfo(mint: string) {
  if (tokenInfoCache[mint]) {
    return tokenInfoCache[mint];
  }

  try {
    // 首先查询本地文件
    const metadata = await getTokenMetadataFromCache(mint);
    if (metadata) {
      tokenInfoCache[mint] = metadata;
      return metadata;
    }

    // 如果本地文件没有，尝试从API获取
    // 可以使用Jupiter API或Solana上的Token List服务
    const response = await axios.get(`https://cache.jup.ag/tokens`);
    const tokens = response.data;
    const token = tokens.find((t: any) => t.address === mint);

    if (token) {
      const tokenInfo: TokenInfo = {
        mint: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        icon_url: token.logoURI || null
      };

      // 缓存并存储到本地文件
      await saveTokenMetadataToCache(mint, tokenInfo);

      return tokenInfo;
    }

    // 默认值
    const defaultInfo: TokenInfo = {
      mint,
      decimals: 9,
      symbol: mint.slice(0, 5),
      name: mint.slice(0, 5),
      icon_url: null
    };
    return defaultInfo;
  } catch (error) {
    console.error(`获取代币信息出错: ${mint}`, error);
    return {
      mint,
      decimals: 9,
      symbol: mint.slice(0, 5),
      name: mint.slice(0, 5),
      icon_url: null
    };
  }
}

// 估算交易的美元价值
async function estimateUsdValue(mint: string, amount: number, decimals: number, timestamp: number) {
  try {
    // 首先尝试获取接近的价格记录
    const prices: TokenPrice[] = await getTokenPricesFromCache();

    // 获取60分钟内最近的价格
    const recentPrices = prices
      .filter((p: TokenPrice) => p.mint === mint && Math.abs(p.timestamp - timestamp) < 3600)
      .sort((a: TokenPrice, b: TokenPrice) => Math.abs(a.timestamp - timestamp) - Math.abs(b.timestamp - timestamp));

    if (recentPrices.length > 0) {
      const price = recentPrices[0].price_usd;
      return (amount / Math.pow(10, decimals)) * price;
    }

    // 如果没有历史价格，尝试获取当前价格
    // (实际项目中应该有一个完整的价格服务)
    const currentPrice = await getCurrentTokenPrice(mint);
    if (currentPrice) {
      // 保存当前价格到文件
      const newPrice: TokenPrice = {
        mint,
        price_usd: currentPrice,
        timestamp: Math.floor(Date.now() / 1000)
      };
      const allPrices: TokenPrice[] = await getTokenPricesFromCache();
      allPrices.push(newPrice);

      // 只保留最近7天的价格数据
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
      const filteredPrices = allPrices.filter((p: TokenPrice) => p.timestamp > sevenDaysAgo);
      await saveTokenPricesToCache(filteredPrices);

      return (amount / Math.pow(10, decimals)) * currentPrice;
    }

    return 0; // 无法估算
  } catch (error) {
    console.error(`估算美元价值出错: ${mint}`, error);
    return 0;
  }
}

// 获取当前代币价格
async function getCurrentTokenPrice(mint: string): Promise<number | null> {
  try {
    // 可以使用Jupiter API或其他价格源
    const response = await axios.get(`https://price.jup.ag/v4/price?ids=${mint}`);
    if (response.data && response.data.data && response.data.data[mint]) {
      return response.data.data[mint].price;
    }
    return null;
  } catch (error) {
    console.error(`获取价格出错: ${mint}`, error);
    return null;
  }
}

// 导入solana连接实例
import solana_connect_instance from "@/lib/solana";

// 获取指定区块中的所有交易
export async function getBlockTransactions(slot: number) {
  const connection = solana_connect_instance.getConnection();
  
  try {
    console.log(`开始获取区块 ${slot} 中的所有交易...`);
    
    // 获取区块信息，包含所有交易
    const block = await connection.getBlock(slot, {
      maxSupportedTransactionVersion: 0,
      transactionDetails: "full",
      rewards: false
    });
    
    if (!block) {
      console.warn(`区块 ${slot} 不存在或无法访问`);
      return null;
    }
    
    console.log(`区块 ${slot} 包含 ${block.transactions.length} 个交易`);
    
    // 返回区块信息和交易列表
    return {
      slot: slot,
      blockTime: block.blockTime,
      blockHash: block.blockhash,
      parentSlot: block.parentSlot,
      transactionCount: block.transactions.length,
      transactions: block.transactions.map((tx, index) => ({
        index,
        signature: tx.transaction.signatures[0],
        transaction: tx,
        meta: tx.meta
      }))
    };
    
  } catch (error) {
    console.error(`获取区块 ${slot} 交易失败:`, error);
    throw error;
  }
}

// 获取区块中特定协议的交易（优化版本）
export async function getBlockTransactionsByProtocol(slot: number, programId: string) {
  try {
    console.log(`开始获取区块 ${slot} 中协议 ${programId} 的交易...`);
    
    const blockData = await getBlockTransactions(slot);
    if (!blockData) {
      return null;
    }
    
    // 过滤出与指定程序ID相关的交易 - 参照优化的代码模式
    const protocolTransactions = blockData.transactions.filter(tx => {
      // 检查交易是否涉及指定的程序ID
      const message = tx.transaction.transaction.message;
      // 使用getAccountKeys方法获取账户密钥
      const accountKeys = message.getAccountKeys ? 
        message.getAccountKeys() : [];
      
      if (accountKeys.length === 0) {
        return false;
      } else {
        // 检查是否为MessageAccountKeys类型
        if ('get' in accountKeys) {
          // 使用MessageAccountKeys的get方法
          for (let i = 0; i < accountKeys.length; i++) {
            const key = accountKeys.get(i);
            if (key && key.toString() === programId) {
              return true;
            }
          }
          return false;
        } else {
          // 处理数组类型
          return (accountKeys as any[]).some((key: any) => {
            const keyStr = key.pubkey ? key.pubkey.toString() : key.toString();
            return keyStr === programId;
          });
        }
      }
    });
    
    console.log(`区块 ${slot} 中找到 ${protocolTransactions.length} 个与协议 ${programId} 相关的交易`);
    
    return {
      ...blockData,
      protocolTransactionCount: protocolTransactions.length,
      protocolTransactions
    };
    
  } catch (error) {
    console.error(`获取区块 ${slot} 协议交易失败:`, error);
    throw error;
  }
}

// 批量获取多个区块的交易
export async function getBatchBlockTransactions(slots: number[], maxConcurrent: number = 5) {
  console.log(`开始批量获取 ${slots.length} 个区块的交易...`);
  
  const results: Array<{
    slot: number;
    data: Awaited<ReturnType<typeof getBlockTransactions>> | null;
    error?: string;
  }> = [];
  
  // 分批处理，控制并发数量
  for (let i = 0; i < slots.length; i += maxConcurrent) {
    const batch = slots.slice(i, i + maxConcurrent);
    
    const batchPromises = batch.map(async slot => {
      try {
        const data = await getBlockTransactions(slot);
        return { slot, data };
      } catch (error) {
        return { 
          slot, 
          data: null, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          slot: 0, // 无法确定具体slot
          data: null,
          error: result.reason
        });
      }
    });
    
    console.log(`已处理 ${Math.min(i + maxConcurrent, slots.length)}/${slots.length} 个区块`);
  }
  
  const successCount = results.filter(r => r.data !== null).length;
  console.log(`批量获取完成，成功: ${successCount}/${slots.length}`);
  
  return results;
}

// 获取区块范围内的所有交易
export async function getBlockRangeTransactions(startSlot: number, endSlot: number, maxConcurrent: number = 3) {
  const slots = [];
  for (let slot = startSlot; slot <= endSlot; slot++) {
    slots.push(slot);
  }
  
  console.log(`开始获取区块范围 ${startSlot} - ${endSlot} 的所有交易，共 ${slots.length} 个区块`);
  
  return await getBatchBlockTransactions(slots, maxConcurrent);
}

// 获取区块中所有交易的基本统计信息
export async function getBlockTransactionStats(slot: number) {
  try {
    const blockData = await getBlockTransactions(slot);
    if (!blockData) {
      return null;
    }
    
    const stats = {
      slot: blockData.slot,
      blockTime: blockData.blockTime,
      totalTransactions: blockData.transactionCount,
      successfulTransactions: 0,
      failedTransactions: 0,
      uniqueSigners: new Set<string>(),
      totalFees: 0
    };
    
    blockData.transactions.forEach(tx => {
      // 统计成功和失败的交易
      if (tx.meta?.err) {
        stats.failedTransactions++;
      } else {
        stats.successfulTransactions++;
      }
      
      // 统计费用
      if (tx.meta?.fee) {
        stats.totalFees += tx.meta.fee;
      }
      
      // 统计唯一签名者
      if (tx.transaction.transaction.message.getAccountKeys) {
        const accountKeys = tx.transaction.transaction.message.getAccountKeys();
        if (accountKeys.length > 0) {
          // 正确使用MessageAccountKeys的get方法
          const firstAccount = accountKeys.get(0);
          if (firstAccount) {
            const signerKey = firstAccount.toString();
            stats.uniqueSigners.add(signerKey);
          }
        }
      }
    });
    
    return {
      ...stats,
      uniqueSignersCount: stats.uniqueSigners.size,
      successRate: (stats.successfulTransactions / stats.totalTransactions * 100).toFixed(2) + '%'
    };
    
  } catch (error) {
    console.error(`获取区块 ${slot} 统计信息失败:`, error);
    throw error;
  }
}
