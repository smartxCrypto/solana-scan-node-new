import { pgTable, serial, varchar, bigint, doublePrecision, timestamp } from 'drizzle-orm/pg-core';

// lp_info 表 - 流动性池信息
export const lpInfo = pgTable('lp_info', {
    id: serial('id').primaryKey(),
    poolAddress: varchar('pool_address', { length: 50 }).notNull().unique(),
    tokenAMint: varchar('token_a_mint', { length: 128 }).notNull(),
    tokenBMint: varchar('token_b_mint', { length: 128 }).notNull(),
    tokenASymbol: varchar('token_a_symbol', { length: 255 }).notNull(),
    tokenBSymbol: varchar('token_b_symbol', { length: 255 }).notNull(),
    tokenAAmount: bigint('token_a_amount', { mode: 'number' }).notNull(),
    tokenBAmount: bigint('token_b_amount', { mode: 'number' }).notNull(),
    liquidityUsd: bigint('liquidity_usd', { mode: 'number' }).notNull(),
    feeRate: doublePrecision('fee_rate').notNull(),
    createdTimestamp: bigint('created_timestamp', { mode: 'number' }).notNull(),
    lastUpdatedTimestamp: bigint('last_updated_timestamp', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export type LpInfo = typeof lpInfo.$inferSelect;
export type NewLpInfo = typeof lpInfo.$inferInsert;

