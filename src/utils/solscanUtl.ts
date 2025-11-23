import { SolscanTokenInfo, SolscanTokenInfoResponse } from "@/type/solscan";
import { SOL_SCAN_API_KEY } from "../constant/config";
import { TokenInfo } from "@/type/token";

export class SolScanAPi {
    private apiKey: string;

    constructor() {
        this.apiKey = SOL_SCAN_API_KEY || '';
    }

    /**
     * get token info from solscan
     * @param mint token mint address
     * @returns token info
     */
    public async getTokenInfo(mint: string): Promise<SolscanTokenInfo> {
        const requestOptions = {
            method: "get",
            headers: { "token": this.apiKey }
        }

        const response = await fetch(`https://pro-api.solscan.io/v2.0/token/meta?address=${mint}`, requestOptions)
        const data: SolscanTokenInfoResponse<SolscanTokenInfo> = await response.json();

        return data.data;
    }

    /**
     * get multi token address
     * @param mint token mint address
     * @returns token price
     */
    public async getMultiTokenInfo(mint: string[]): Promise<SolscanTokenInfo[]> {

        let tokenAddressMintList: string[] = mint;

        let result: SolscanTokenInfo[] = [];

        if (mint.length === 0) {
            return [];
        }

        if (mint.length > 20) {
            const tokenInfoList = await this.getMultiTokenInfo(mint.slice(20));
            result = [...result, ...tokenInfoList];
            tokenAddressMintList = mint.slice(0, 20);
        }

        const requestOptions = {
            method: "get",
            headers: { "token": this.apiKey }
        }

        const response = await fetch(`https://pro-api.solscan.io/v2.0/token/meta/multi?address[]=${tokenAddressMintList.join("&address[]=")}`, requestOptions)
        const data: SolscanTokenInfoResponse<SolscanTokenInfo[]> = await response.json();

        console.log(data);
        result = [...result, ...data.data];

        return result;
    }


    public solscanTokenInfoToTokenInfo(solscanTokenInfo: SolscanTokenInfo): TokenInfo {
        return {
            token_address: solscanTokenInfo.address,
            name: solscanTokenInfo.name,
            symbol: solscanTokenInfo.symbol,
            decimals: solscanTokenInfo.decimals,
            total_supply: Number(solscanTokenInfo.supply),
            logo_url: solscanTokenInfo.icon || '',
            website_url: solscanTokenInfo.metadata?.website,
            twitter_url: solscanTokenInfo.metadata?.twitter,
            token_create_ts: solscanTokenInfo.created_time,
            creator_address: solscanTokenInfo.creator,
            create_tx: solscanTokenInfo.create_tx,
            sol_scan_image: solscanTokenInfo.icon || ''
        }
    }
}