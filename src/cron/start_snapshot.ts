#!/usr/bin/env node

import 'module-alias/register';
import { snapshotScheduler } from "./snapshot";
import { exit, addSignalListener } from "@/lib/node-utils";

console.log("🚀 Starting Snapshot Scheduler...");
console.log("📊 Configuration:");
console.log("   - Snapshot interval: 50 blocks");
console.log("   - Safety buffer: 10 blocks (won't process latest 10 blocks)");
console.log("   - Check interval: 30 seconds");

// 优雅关闭处理
const handleShutdown = () => {
    console.log("\n📤 Received shutdown signal, stopping snapshot scheduler...");
    snapshotScheduler.stop();
    exit(0);
};

// 监听关闭信号
addSignalListener("SIGINT", handleShutdown);
addSignalListener("SIGTERM", handleShutdown);

// 启动调度器
snapshotScheduler.start().catch((error) => {
    console.error("❌ Snapshot scheduler failed to start:", error);
    exit(1);
}); 