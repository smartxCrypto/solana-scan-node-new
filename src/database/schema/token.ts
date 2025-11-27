import { pgTable, bigserial, varchar, integer, numeric, bigint, boolean, text, timestamp } from 'drizzle-orm/pg-core';

// tokens 表 - 代币基础信息
export const token = pgTable('tokens', {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    symbol: varchar('symbol', { length: 255 }),
    logoUrl: varchar('logo_url', { length: 512 }),
    websiteUrl: varchar('website_url', { length: 512 }),
    twitterUrl: varchar('twitter_url', { length: 512 }),
    telegramUrl: varchar('telegram_url', { length: 512 }),
    tokenAddress: varchar('token_address', { length: 50 }).notNull().unique(),
    decimals: integer('decimals').notNull(),
    isRiskToken: boolean('is_risk_token').default(false),
    totalSupply: numeric('total_supply', { precision: 30, scale: 8 }).notNull(),
    firstSeenTimestamp: bigint('first_seen_timestamp', { mode: 'number' }),
    metaUri: text('meta_uri'),
    tokenCreateTs: bigint('token_create_ts', { mode: 'number' }),
    solScanImage: varchar('sol_scan_image', { length: 255 }),
    latestPrice: numeric('latest_price', { precision: 20, scale: 12 }).default('0'),
    latestPriceUpdateTs: bigint('latest_price_update_ts', { mode: 'number' }),
    creatorAddress: varchar('creator_address', { length: 255 }),
    createTx: varchar('create_tx', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export type Token = typeof token.$inferSelect;
export type NewToken = typeof token.$inferInsert;

