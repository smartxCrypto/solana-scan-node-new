/**
 * PostgreSQL 数据库操作迁移映射
 * 
 * 此文件提供了从旧的 postgresqlHelper 方式到新的 Drizzle Repository 方式的迁移映射
 */

// ============================================
// 快照信息 (snapshot_info 表)
// ============================================

// 旧方式: src/service/snapshot/snapshot.ts (使用 postgresqlHelper)
// 新方式: src/service/snapshot/snapshot-new.ts (使用 SnapshotInfoRepository)
// 导入: src/service/snapshot/snapshot.ts 已重定向到新版本

export const SNAPSHOT_INFO_MIGRATION = {
    old: 'src/service/snapshot/snapshot.ts (使用 commonQuery)',
    new: 'src/service/snapshot/snapshot-new.ts (使用 SnapshotInfoRepository)',
    repository: 'src/database/repositories/SnapshotInfoRepository.ts',
    status: '✅ 已迁移',
    methods: {
        createSnapshot: 'SnapshotInfoRepository.create()',
        getSnapshotById: 'SnapshotInfoRepository.findById()',
        getLatestSnapshotByType: 'SnapshotInfoRepository.findLatestByType()',
        getSnapshotsByType: 'SnapshotInfoRepository.findByType()',
        getSnapshotsByTimeRange: 'SnapshotInfoRepository.findByTimeRange()',
        updateSnapshot: 'SnapshotInfoRepository.update()',
        deleteSnapshot: 'SnapshotInfoRepository.delete()',
        batchCreateSnapshots: 'SnapshotInfoRepository.batchCreate()',
        getSnapshotCount: 'SnapshotInfoRepository.count()',
    }
};

// ============================================
// 钱包交易快照 (wallet_trading_ss 表)
// ============================================

// 旧方式: src/service/snapshot/wallet_trading_ss.ts (使用 postgresqlHelper)
// 新方式: src/service/snapshot/wallet_trading_ss-new.ts (使用 WalletTradingSnapshotRepository)

export const WALLET_TRADING_SS_MIGRATION = {
    old: 'src/service/snapshot/wallet_trading_ss.ts (使用 commonQuery/commonInsert)',
    new: 'src/service/snapshot/wallet_trading_ss-new.ts (使用 WalletTradingSnapshotRepository)',
    repository: 'src/database/repositories/WalletTradingSnapshotRepository.ts',
    status: '✅ 新版本已创建，待切换',
    methods: {
        createWalletTradingSnapshot: 'WalletTradingSnapshotRepository.create()',
        batchCreateWalletTradingSnapshots: 'WalletTradingSnapshotRepository.batchCreate()',
        getWalletTradingSnapshotById: 'WalletTradingSnapshotRepository.findById()',
        getLatestWalletTradingSnapshot: 'WalletTradingSnapshotRepository.findLatestByWallet()',
        getLatestWalletTradingSnapshotBeforeTime: 'WalletTradingSnapshotRepository.findLatestBeforeTime()',
        batchGetLatestWalletTradingSnapshotBeforeTime: 'WalletTradingSnapshotRepository.batchFindLatestBeforeTime()',
        getWalletTradingSnapshots: 'WalletTradingSnapshotRepository.findByWallet()',
        getWalletsByProfitLoss: 'WalletTradingSnapshotRepository.findByProfitLoss()',
        updateWalletTradingSnapshot: 'WalletTradingSnapshotRepository.update()',
        deleteWalletTradingSnapshot: 'WalletTradingSnapshotRepository.delete()',
        saveWalletTradingSnapshots: 'WalletTradingSnapshotRepository.saveSnapshots()',
    }
};

// ============================================
// 代币快照 (token_ss 表)
// ============================================

// 旧方式: src/service/snapshot/token_ss.ts (使用 postgresqlHelper)
// 新方式: src/service/snapshot/token_ss-new.ts (使用 TokenSnapshotRepository)

export const TOKEN_SS_MIGRATION = {
    old: 'src/service/snapshot/token_ss.ts (使用 commonQuery/commonInsert)',
    new: 'src/service/snapshot/token_ss-new.ts (使用 TokenSnapshotRepository)',
    repository: 'src/database/repositories/TokenSnapshotRepository.ts',
    status: '✅ 新版本已创建，待切换',
    methods: {
        createTokenSnapshot: 'TokenSnapshotRepository.create()',
        batchCreateTokenSnapshots: 'TokenSnapshotRepository.batchCreate()',
        getLatestTokenSnapshot: 'TokenSnapshotRepository.findLatestByToken()',
        getTokenSnapshots: 'TokenSnapshotRepository.findByToken()',
        getTokenSnapshotsByBlockRange: 'TokenSnapshotRepository.findByBlockRange()',
        saveTokenSnapshots: 'TokenSnapshotRepository.saveSnapshots()',
    }
};

// ============================================
// 迁移步骤
// ============================================

export const MIGRATION_STEPS = [
    {
        step: 1,
        title: '创建 Drizzle Schema 和 Repository',
        files: [
            'src/database/schema/*.ts',
            'src/database/repositories/*.ts',
            'src/database/client.ts',
        ],
        status: '✅ 完成',
    },
    {
        step: 2,
        title: '创建新版本服务层',
        files: [
            'src/service/snapshot/snapshot-new.ts',
            'src/service/snapshot/wallet_trading_ss-new.ts',
            'src/service/snapshot/token_ss-new.ts',
        ],
        status: '✅ 完成',
    },
    {
        step: 3,
        title: '切换导入到新版本',
        action: '将 snapshot.ts 重定向到 snapshot-new.ts',
        todo: [
            '将 wallet_trading_ss.ts 切换到 wallet_trading_ss-new.ts',
            '将 token_ss.ts 切换到 token_ss-new.ts',
        ],
        status: '⏳ 进行中',
    },
    {
        step: 4,
        title: '更新所有导入语句',
        files: [
            'src/snap-shot/wallet-trading/index.ts',
            'src/snap-shot/token/index.ts',
            'src/snap-shot/index.ts',
        ],
        status: '⏳ 待进行',
    },
    {
        step: 5,
        title: '测试验证',
        tests: [
            'npm test drizzle.test.ts',
            'npm test postgre.test.ts',
            'npm test snapshot.test.ts',
        ],
        status: '⏳ 待进行',
    },
    {
        step: 6,
        title: '删除旧文件',
        files: [
            'src/utils/postgresqlHelper.ts',
            'src/service/snapshot/snapshot.ts (old)',
            'src/service/snapshot/wallet_trading_ss.ts (old)',
            'src/service/snapshot/token_ss.ts (old)',
        ],
        status: '⏳ 待进行',
    },
];

// ============================================
// 使用示例对比
// ============================================

export const USAGE_EXAMPLES = {
    // 创建快照
    CREATE_SNAPSHOT: {
        old: `
// 旧方式
const sql = 'INSERT INTO snapshot_info (...) VALUES (?, ?, ?, ?)';
const result = await commonInsert(sql, [timestamp, type, blockHeight, blockTime]);
        `,
        new: `
// 新方式
const result = await SnapshotInfoRepository.create({
    timestamp, type, blockHeight, blockTime
});
        `,
    },
    
    // 查询快照
    QUERY_SNAPSHOT: {
        old: `
// 旧方式
const sql = 'SELECT * FROM snapshot_info WHERE type = ? ORDER BY timestamp DESC LIMIT 1';
const result = await commonQuery(sql, [type]);
return result[0] || null;
        `,
        new: `
// 新方式
const result = await SnapshotInfoRepository.findLatestByType(type);
return result || null;
        `,
    },
    
    // 批量创建
    BATCH_CREATE: {
        old: `
// 旧方式
const values = snapshots.map(() => '(?, ?, ?, ?)').join(', ');
const sql = \`INSERT INTO wallet_trading_ss (...) VALUES \${values}\`;
const params = snapshots.flatMap(s => [s.field1, s.field2, ...]);
await commonInsert(sql, params);
        `,
        new: `
// 新方式
await WalletTradingSnapshotRepository.batchCreate(snapshots);
        `,
    },
};

console.log('迁移映射文件已加载');
console.log('请查看 DRIZZLE_MIGRATION.md 了解详细迁移指南');

