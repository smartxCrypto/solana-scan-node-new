// src/utils/SolanaBlockUtil
import solana_connect_instance from "../lib/solana";
import { subscribe, CommitmentLevel, LaserstreamConfig, SubscribeRequest } from 'helius-laserstream'

export class SolanaBlockUtil {
  private static connection = solana_connect_instance.getConnection(); // 使用你的 Solana 连接实例o

  /**
   * 获取最新 slot（当前区块）
   */
  public static async getLatestSlot(): Promise<number> {
    return await this.connection.getSlot("confirmed");
  }


  public static async getPumpFunBlock() {
    const subscriptionRequest: SubscribeRequest = {
      transactions: {
      },
      commitment: CommitmentLevel.CONFIRMED,
      accounts: {},
      slots: {},
      transactionsStatus: {},
      blocks: {
        // myBlockLabel is a user-defined label for this block filter configuration
        myBlockLabel: {
          // Only broadcast blocks referencing these accounts
          accountInclude: ["pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"],
          includeTransactions: true,
          includeAccounts: false,
          includeEntries: false
        }
      },
      blocksMeta: {},
      entry: {},
      accountsDataSlice: [],
      // Optionally, you can replay missed data by specifying a fromSlot:
      // fromSlot: '224339000'
      // Note: Currently, you can only replay data from up to 3000 slots in the past.
    };

    // Replace the values below with your actual LaserStream API key and endpoint
    const config: LaserstreamConfig = {
      apiKey: '3ed35a0b-35f6-4adb-8caa-5c72cd36b023', // Replace with your key from https://dashboard.helius.dev/
      endpoint: 'https://laserstream-mainnet-ewr.helius-rpc.com', // Choose your closest region
    }

    await subscribe(config, subscriptionRequest, async (data) => {

      console.log(data);
      // Deno.writeTextFileSync('data.json', JSON.stringify(data, null, 2));

    }, async (error) => {
      console.error(error);
    });
  }

  /**
   * 获取最新 block height（链上高度）
   */
  public static async getLatestBlockHeight(): Promise<number> {
    return await this.connection.getBlockHeight("confirmed");
  }

  /**
   * 获取 slot 和 block height 一起返回
   */
  public static async getLatestBlockInfo(): Promise<
    { slot: number; blockHeight: number }
  > {
    const [slot, blockHeight] = await Promise.all([
      this.getLatestSlot(),
      this.getLatestBlockHeight(),
    ]);
    return { slot, blockHeight };
  }

  public static async getFirstAvailableBlock(): Promise<number> {
    return await this.connection.getFirstAvailableBlock();
  }

  public static async getBlockData(blockNumber: number, index: number): Promise<{ data: any; skip: boolean }> {
    try {
      const connection = solana_connect_instance.getConnection()
      const block = await connection.getBlock(blockNumber, {
        maxSupportedTransactionVersion: 0,
      });
      return { data: block, skip: false };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === -32007) {
        // console.log(JSON.stringify(error, null, 2));
        return { data: null, skip: true };
      } else {
        console.error('getBlockData error:', error);
      }
    }
    return { data: null, skip: false };
  };
}
// const latestSlot = await SolanaBlockUtil.getLatestSlot();
// console.log(latestSlot);
// const data=await SolanaBlockUtil.getBlockData(latestSlot,0);
// console.log(data);
