import { SubscribeUpdateBlock } from "@triton-one/yellowstone-grpc";
import { exportDexparserInstance } from "../collection/dex-parser";
import { readFileSync, writeFileSync } from "fs-extra";
import { BlockDataSerializer } from "../lib/block-data-serializer";

describe('grpc block test', () => {
    test('should parse grpc block', async () => {
        const blockSubscripe = readFileSync('./src/__tests__/__test_value__/grpc-block.json', 'utf-8');
        const blockValue = BlockDataSerializer.deserialize(blockSubscripe);

        const blockParseResult = await exportDexparserInstance.parseBlockData(blockValue, 381503975);
        const serializedParseResult = JSON.stringify(blockParseResult, BlockDataSerializer.replacer, 2);
        writeFileSync('./src/__tests__/__test_value_result__/grpc_block_result.json', serializedParseResult);
    });
});