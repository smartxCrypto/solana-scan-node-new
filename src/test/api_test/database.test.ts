import { SolanaBlockDataHandler } from "../../service/SolanaBlockDataHandler";
import { readTextFileSync } from "../../lib/node-utils";

describe("database test", () => {
    jest.setTimeout(100000);
    test("test for get multi token price", async () => {
        const tokenAddresses = JSON.parse(readTextFileSync("uniqueTokenAddresses.json"));
        const tokenPrices = await SolanaBlockDataHandler.getMultiTokenPrice(tokenAddresses);
        console.log(tokenPrices);
    });
});