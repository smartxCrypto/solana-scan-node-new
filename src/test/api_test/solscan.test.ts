import { SolScanAPi } from "../../utils/solscanUtl";
import dotenv from 'dotenv';
import { getTokensWithEmptySolScanImage } from "../../service/TokenInfoService";

describe('SolScanAPi', () => {
    it('should get token info', async () => {
        const solscanApi = new SolScanAPi();
        const data = await solscanApi.getTokenInfo('ELkLXEaChBmNxaaVavYn9Xk9pf26BZg3TxrzP8o91sek');
        console.log(data);
        expect(data).toBeDefined();
    });

    test("get token with empty sol_scan_image", async () => {
        const data = await getTokensWithEmptySolScanImage(1511, 20);
        const tokenAddresses = data.data.map(item => item.token_address);

        const solscanApi = new SolScanAPi();
        const tokenList = await solscanApi.getMultiTokenInfo(tokenAddresses);
        console.log(tokenList);

        expect(data).toBeDefined();
    });
});