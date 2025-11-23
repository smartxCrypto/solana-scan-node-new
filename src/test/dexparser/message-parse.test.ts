import { readFileSync, writeFileSync } from "fs-extra";
import { BlockDataSerializer } from "../../lib/block-data-serializer";
import { exportDexparserInstance } from "../../collection/dex-parser";
import { BlockDataConverter } from "../../lib/block-data-converter";


describe('DexParser', () => {
    test('should parse GRPC message to Solana message', async () => {
        const blockData = readFileSync("./src/test/test_data/block_data.json", "utf-8");
        const blockDataObj = BlockDataSerializer.deserialize(blockData);
        const parseResult = await exportDexparserInstance.parseBlockData(blockDataObj, 1);

        const serializedParseResult = JSON.stringify(parseResult, BlockDataSerializer.replacer, 2);

        writeFileSync("./src/test/test_data/parse_result.json", serializedParseResult);
    });
    test('should parse GRPC message to Solana message result', async () => {
        const blockData = readFileSync("./src/test/test_data/og_block_data_375235472.json", "utf-8");
        const blockDataObj = JSON.parse(blockData);
        const grpcData = BlockDataConverter.convertRpcToGrpc(blockDataObj);
        const parseResult = await exportDexparserInstance.parseBlockData(grpcData, 375235472);

        const serializedParseResult = JSON.stringify(parseResult, BlockDataSerializer.replacer, 2);

        writeFileSync("./src/test/test_data/parse_result_375235472.json", serializedParseResult);
    });
});
