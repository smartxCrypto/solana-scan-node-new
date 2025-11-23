// 使用 Deno 的  模块前缀方式
import {
    fetchDigitalAsset,
    mplTokenMetadata,
    type DigitalAsset,
} from "@metaplex-foundation/mpl-token-metadata";

import { Connection, PublicKey } from "@solana/web3.js";
import { PublicKey as UmiPublicKey } from "@metaplex-foundation/umi";


import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import solana_connect_instance from "../lib/solana";


// 定义返回类型结构
export interface TokenMetadataResult {
    decimals: number;
    supply: number;
    symbol: string;
    name: string;
    uri: string;
    image: string;
}

export class FetchTokenMetadataService {
    private readonly connection: Connection;
    private readonly umi: ReturnType<typeof createUmi>;

    constructor() {
        this.connection = solana_connect_instance.getConnection();
        this.umi = createUmi(this.connection).use(mplTokenMetadata());
    }

    // 主方法：根据 mint 地址获取 metadata
    public async fetch(mintAddress: string): Promise<TokenMetadataResult | null> {
        const mintPublicKey = new PublicKey(mintAddress);
        // console.log(`Fetching token metadata: ${mintAddress}`);

        let asset: DigitalAsset | null = null;

        try {
            asset = await fetchDigitalAsset(this.umi, mintPublicKey as unknown as UmiPublicKey);
        } catch (err) {
            // console.warn("fetchDigitalAsset failed:", err);
        }

        if (!asset) {
            console.log("No asset found for mint:", mintAddress);
            return null;
        }

        const supply = asset.mint.supply.toString();
        const decimals = asset.mint.decimals;
        const readableSupply = Number(supply) / 10 ** decimals;
        const image = await this.getImage(asset.metadata.uri);

        return {
            decimals,
            supply: readableSupply,
            symbol: asset.metadata.symbol,
            name: asset.metadata.name,
            uri: asset.metadata.uri,
            image,
        };
    }

    // 辅助方法：根据 URI 获取 JSON 并提取 image
    private async getImage(uri: string): Promise<string> {
        try {
            // console.log(`Fetching token URI JSON: ${uri}`);
            const res = await fetch(uri);
            const data = await res.json();
            return data["image"] ?? "";
        } catch (e) {
            // console.warn("fetchDigitalAsset failed:", e);
        }
        return "";
    }
}

export const fetchTokenMetadataService = new FetchTokenMetadataService();
// const result = await tokenMetadataService.fetch("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
// console.log(result);
