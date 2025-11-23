import { ISmartMoneyAnalysisConfig, SmartMoneyType } from "../type/smart-money";

export const SMART_MONEY_DATA_PARSE_BECH_MARK = {
    [SmartMoneyType.HIGH_WINRATE]: {
        native_token_balance: 0.5,
        wallet_balance: 1,
        profit: 0.025,
        effective_win_token_pct: 0.6,
        token_buy_counts: 0.3,
        active_days: 0.3,
    },
    [SmartMoneyType.HIGH_PROFIT]: {
        profit: 0.7,
        effective_win_token_pct: 0.5,
        native_token_balance: 0.5,
        wallet_balance: 1,
        token_buy_counts: 0.1,
        active_days: 0.3,
    },
    [SmartMoneyType.WHALE_MID_PROFIT]: {
        native_token_balance: 1000,
        wallet_balance: 2000,
        effective_win_token_pct: 0.3,
        token_buy_counts: 0.1,
        active_days: 0.3,
    }
}


// 时间窗口天数
export const SM_TWL = 30

export const SmartMoneyAnalysisConfig: ISmartMoneyAnalysisConfig = {
    DAYS_AGO: 1, // 分析周期天
    BLOCKS_AGO: 9000, //9000个区块 过去一小时
    BASELINE_DAYS_AGO: 1,       // 5天前作为基准
    TWL: 1,                     // 时间窗口长度为5
    MIN_TRANSACTION_COUNT: 5    // 最低交易次数
}   