import { writeFileSync } from 'fs-extra';
import { getBlockTransactions } from '../collection/transactions/utils';

describe('getblock', () => {
    jest.setTimeout(100000);
    test('should get block', async () => {
        const block = await getBlockTransactions(381503975);
        const fileName = `./src/test/test_data/og_block_data_${Number(block?.slot)}.json`;
        writeFileSync(fileName, JSON.stringify(block, null, 2));
    });
});
