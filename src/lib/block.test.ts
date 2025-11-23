import { getBlockHashBySlotNumber, getBlockTransactionsByProtocol } from "./block";
import solanaConnectInstance from "./solana";

describe("Block utilities", () => {
  test("getBlockHashBySlotNumber", async () => {
    const blockhash = await getBlockHashBySlotNumber(solanaConnectInstance.getConnection(), 344319878);
    console.log(blockhash);
    expect(blockhash).toBe("3QqnZmfk4aJKxrWduBZm2uWrowNsC22fgHUVM9J5F7bqkwPcKEZX3yhZ3xDSqnVUobe2g5mRiXjckGWPzsH9Nshp");
  });


});