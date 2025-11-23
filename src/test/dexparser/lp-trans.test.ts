import { BlockDataSerializer } from "../../scan/BlockDataSerializer"
import redisClient from "../../constant/config/redis"
import { exportDexparserInstance } from "../../collection/dex-parser"
import { SolanaBlockDataHandler } from "../../service/SolanaBlockDataHandler"
describe("test  the lp info", () => {
    jest.setTimeout(10000000)
    test("test the lp usd", async () => {
        const blockNumber = 349511729
        let blockData = await BlockDataSerializer.getBlockDataFromRedis(blockNumber);
        if (!blockData) {
            await redisClient.hdel(BlockDataSerializer.cache_key, String(blockNumber));
            return;
        }
        const parseResult = await exportDexparserInstance.parseBlockData(
            blockData,
            blockNumber,
        );
        const fileteTransactions = parseResult.filter((tx) =>
            tx.result?.trades?.length > 0 && tx.trades.length > 0
        );

        await SolanaBlockDataHandler.convertToLpInfoUpdateList(fileteTransactions)
    })
})