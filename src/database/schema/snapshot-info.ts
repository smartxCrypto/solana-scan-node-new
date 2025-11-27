import { pgTable, serial, bigint, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

// 快照类型枚举
export const snapshotTypeEnum = pgEnum('snapshot_type_enum', [
    'TokenNormSnapShot',
    'SnapShotForWalletTrading'
]);

// snapshot_info 表
export const snapshotInfo = pgTable('snapshot_info', {
    id: serial('id').primaryKey(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    type: snapshotTypeEnum('type').notNull(),
    blockHeight: bigint('block_height', { mode: 'number' }).notNull(),
    blockTime: bigint('block_time', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export type SnapshotInfo = typeof snapshotInfo.$inferSelect;
export type NewSnapshotInfo = typeof snapshotInfo.$inferInsert;

