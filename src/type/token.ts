export interface TokenInfo {
    id?: string;
    name: string;
    symbol?: string
    logo_url?: string
    website_url?: string
    twitter_url?: string
    telegram_url?: string
    token_address: string
    decimals: number
    is_risk_token?: boolean
    total_supply: number
    first_seen_timestamp?: number
    created_at?: string
    updated_at?: string
    meta_uri?: string
    token_create_ts?: number
    latest_price?: number
    creator_address?: string
    create_tx?: string
    sol_scan_image?: string
}
