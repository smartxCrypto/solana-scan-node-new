
export interface ResSwapStruct {
    id: number;
    transaction_signature: string;
    block_time: number;
    slot: number;
    user_address: string;
    protocol: string;
    pool_address: string;
    token_in_mint: string;
    token_out_mint: string;
    token_in_amount: number;
    token_out_amount: number;
    token_in_amount_raw: number;
    token_out_amount_raw: number;
    token_in_symbol: string;
    token_out_symbol: string;
    token_in_decimals: number;
    token_out_decimals: number;
    usd_value: number;
    price_impact: number;
    fee_amount: number;
    is_direct_route: boolean;
    route_count: number;
    status: string;
    error_message: string;
    raw_data: string;
    processed_at: number;
}


export interface ResTokenPriceStruct {
    mint: string;
    timestamp: number;
    price_usd: number;
    price_sol: number;
    liquidity_usd: number;
    volume_24h: number;
    source_pool: string;
}


export interface ResTokenMetadataStruct {
    mint: string;
    name: string;
    symbol: string;
    decimals: number;
    icon_url: string;
    url: string;
    total_supply: number;
    first_seen_timestamp: number;
    last_updated_timestamp: number;
}


export interface ResLpInfoStruct {
    pool_address: string;
    protocol: string;
    token_a_mint: string;
    token_b_mint: string;
    token_a_symbol: string;
    token_b_symbol: string;
    token_a_amount: number;
    token_b_amount: number;
    liquidity_usd: number;
    fee_rate: number;
    is_verified: boolean;
    created_timestamp: number;
    last_updated_timestamp: number;
}

export interface ResUserTradingSummaryStruct {
    user_address: string;
    period_end: number;
    period_type: string;
    total_swaps: number;
    unique_tokens_bought: number;
    unique_tokens_sold: number;
    total_volume_usd: number;
    avg_swap_size_usd: number;
    profit_usd: number;
}