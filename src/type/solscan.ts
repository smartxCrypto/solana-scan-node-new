export interface SolscanTokenInfoResponse<T> {
    success: boolean;
    data: T;
}

export interface SolscanTokenInfo {
        address: string;
        name: string;
        symbol: string;
        icon: string;
        decimals: number;
        holder: number;
        creator: string;
        create_tx: string;
        created_time: number;
        metadata: {
            name: string;
            image: string;
            symbol: string;
            description: string;
            twitter: string;
            website: string;
        }
        metadata_uri: string;
        mint_authority: string | null;
        freeze_authority: string | null;
        supply: string;
        price: number;
        volume_24h: number;
        market_cap: number;
        market_cap_rank: number;
        price_change_24h: number;
        total_dex_vol_24h: number;
        dex_vol_change_24h: number;
}