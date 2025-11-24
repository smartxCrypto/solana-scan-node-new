import { readFileSync, writeFileSync } from "fs-extra";
import { getBlockTransactions } from "../collection/transactions/utils";
import { BlockDataSerializer } from "../lib/block-data-serializer";
import { BlockDataConverter } from "../lib/block-data-converter";
import { exportDexparserInstance } from "../collection/dex-parser";

describe('get block test', () => {
    test('should get block', async () => {
        const block = await getBlockTransactions(382114936);
        const serializedBlock = JSON.stringify(block, null, 2);
        writeFileSync('./src/__tests__/__test_value__/get_block.json', serializedBlock);
    });
    test('should parse the get block result', async () => {
        const blockData = readFileSync('./src/__tests__/__test_value__/get_block.json', 'utf-8');

        const blockDataObj = JSON.parse(blockData);
        const grpcData = BlockDataConverter.convertRpcToGrpc(blockDataObj);
        const parseResult = await exportDexparserInstance.parseBlockData(grpcData, 382114936);
        const serializedParseResult = JSON.stringify(parseResult, BlockDataSerializer.replacer, 2);
        writeFileSync('./src/__tests__/__test_result_value__/get_block_parse_result.json', serializedParseResult);
    });
});