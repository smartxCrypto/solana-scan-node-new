import { pgTable, bigserial, bigint, varchar, timestamp, jsonb, numeric, integer } from 'drizzle-orm/pg-core';

// wallet_trading_ss 表 - 钱包交易快照
export const walletTradingSnapshot = pgTable('wallet_trading_ss', {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    walletAddress: varchar('wallet_address', { length: 50 }).notNull(),
    snapshotTime: timestamp('snapshot_time').notNull(),
    blockHeight: bigint('block_height', { mode: 'number' }),
    perTLTradingValue: jsonb('per_tl_trading_value').default([]),
    totalBuySolAmount: numeric('total_buy_sol_amount', { precision: 30, scale: 8 }).default('0'),
    totalBuyUsdAmount: numeric('total_buy_usd_amount', { precision: 30, scale: 8 }).default('0'),
    totalSellSolAmount: numeric('total_sell_sol_amount', { precision: 30, scale: 8 }).default('0'),
    totalSellUsdAmount: numeric('total_sell_usd_amount', { precision: 30, scale: 8 }).default('0'),
    buyCount: integer('buy_count').default(0),
    sellCount: integer('sell_count').default(0),
    solPrice: numeric('sol_price', { precision: 20, scale: 12 }).default('0'),
    winCount: integer('win_count').default(0),
    loseCount: integer('lose_count').default(0),
    currentTokenValue: jsonb('current_token_value').default([]),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export type WalletTradingSnapshot = typeof walletTradingSnapshot.$inferSelect;
export type NewWalletTradingSnapshot = typeof walletTradingSnapshot.$inferInsert;

