import { pgTable, bigserial, bigint, timestamp, varchar, numeric, integer } from 'drizzle-orm/pg-core';

// token_ss 表 - 代币快照
export const tokenSnapshot = pgTable('token_ss', {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    blockHeight: bigint('block_height', { mode: 'number' }).notNull(),
    blockTime: timestamp('block_time').notNull(),
    tokenAddress: varchar('token_address', { length: 50 }).notNull(),
    buyAmount: numeric('buy_amount', { precision: 30, scale: 8 }).default('0'),
    sellAmount: numeric('sell_amount', { precision: 30, scale: 8 }).default('0'),
    buyCount: integer('buy_count').default(0),
    sellCount: integer('sell_count').default(0),
    highPrice: numeric('high_price', { precision: 20, scale: 12 }).default('0'),
    lowPrice: numeric('low_price', { precision: 20, scale: 12 }).default('0'),
    startPrice: numeric('start_price', { precision: 20, scale: 12 }).default('0'),
    endPrice: numeric('end_price', { precision: 20, scale: 12 }).default('0'),
    avgPrice: numeric('avg_price', { precision: 20, scale: 12 }).default('0'),
    poolAddress: varchar('pool_address', { length: 50 }),
    snapShotBlockTime: bigint('snap_shot_block_time', { mode: 'number' }).notNull(),
    totalSupply: numeric('total_supply', { precision: 30, scale: 8 }),
    tokenSymbol: varchar('token_symbol', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export type TokenSnapshot = typeof tokenSnapshot.$inferSelect;
export type NewTokenSnapshot = typeof tokenSnapshot.$inferInsert;

