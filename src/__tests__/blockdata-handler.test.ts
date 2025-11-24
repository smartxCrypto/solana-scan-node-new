import { readFileSync, writeFileSync } from "fs-extra";
import { BlockDataConverter } from "../lib/block-data-converter";
import { SolanaBlockDataHandler } from "../service/SolanaBlockDataHandler";
describe('blockdata-handler test', () => {
    test('should convert blockdata to swap transaction', async () => {
        const blockNumber = 382114936;

        const blockData = readFileSync('./src/__tests__/__test_value__/blockdata_handler.json', 'utf-8');

        const blockDataObj = JSON.parse(blockData);
        const grpcData = BlockDataConverter.convertRpcToGrpc(blockDataObj);
        const blockdata = await SolanaBlockDataHandler.handleBlockDataWithBlockData(grpcData, blockNumber);
        const serializedBlockdata = JSON.stringify(blockdata, null, 2);
        writeFileSync('./src/__tests__/__test_result_value__/blockdata_handler_result.json', serializedBlockdata);
    });
});