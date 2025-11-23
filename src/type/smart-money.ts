export enum SmartMoneyType {
    HIGH_WINRATE = 'HIGH_WINRATE',
    HIGH_PROFIT = 'HIGH_PROFIT',
    WHALE_MID_PROFIT = 'WHALE_MID_PROFIT',
    KOL = 'KOL',
}

export interface SmartMoneyDataParser {
    native_token_balance: number;
    wallet_balance: number;
    buy_token_count: number;
    active_days: number;
    token_buy_counts: number;
    effective_win_token_pct: number;
    profit: number;
    weight_hold_time: number;
    weight_average_time: number;
}


export interface SmartMoneyIndicators {

}


export interface ISmartMoneyAnalysisConfig {
    BASELINE_DAYS_AGO: number;
    TWL: number;
    MIN_TRANSACTION_COUNT: number;
    DAYS_AGO: number;
    BLOCKS_AGO: number;
}
