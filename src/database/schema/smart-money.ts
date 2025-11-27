import { pgTable, serial, varchar, numeric, integer, bigint, boolean, timestamp } from 'drizzle-orm/pg-core';

// smart_money_address 表 - 聪明钱地址
export const smartMoneyAddress = pgTable('smart_money_address', {
    id: serial('id').primaryKey(),
    walletAddress: varchar('wallet_address', { length: 50 }).notNull().unique(),
    label: varchar('label', { length: 255 }),
    confidenceScore: numeric('confidence_score', { precision: 5, scale: 2 }).default('0'),
    totalPnl: numeric('total_pnl', { precision: 30, scale: 8 }).default('0'),
    winRate: numeric('win_rate', { precision: 5, scale: 2 }).default('0'),
    totalTrades: integer('total_trades').default(0),
    firstSeenTimestamp: bigint('first_seen_timestamp', { mode: 'number' }),
    lastActiveTimestamp: bigint('last_active_timestamp', { mode: 'number' }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export type SmartMoneyAddress = typeof smartMoneyAddress.$inferSelect;
export type NewSmartMoneyAddress = typeof smartMoneyAddress.$inferInsert;

