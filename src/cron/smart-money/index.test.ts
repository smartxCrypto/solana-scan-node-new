import { SmartMoneyCronJob } from "./index";
import { SmartMoneyAnalyzer, SmartMoneyCategory } from "../../smart-money";
import { readTextFileSync, writeTextFileSync } from "../../lib/node-utils";


describe("smart money cron job", () => {
    jest.setTimeout(100000000);
    test("should run once", async () => {
        const smartMoneyCronJob = new SmartMoneyCronJob();
        const result = await smartMoneyCronJob.execute();
        console.log("smart money cron job execute result:", JSON.stringify(result, null, 2));
    });
});


describe("smart money analysis", () => {
    jest.setTimeout(100000000);
    test("should run once", async () => {
        const smartMoneyAnalyzer = new SmartMoneyAnalyzer();

        const unAnalyzedWallets: string[] = [];
        const baselineSnapshotsJSON = JSON.parse(readTextFileSync("baselineSnapshots.json"));
        const latestSnapshotsJSON = JSON.parse(readTextFileSync("latestSnapshots.json"));

        console.log("baselineSnapshotsJSON", baselineSnapshotsJSON.length);
        console.log("latestSnapshotsJSON", latestSnapshotsJSON.length);


        const baselineSnapshots = new Map<string, any>();
        const latestSnapshots = new Map<string, any>();



        for (const snapshot of baselineSnapshotsJSON) {
            unAnalyzedWallets.push(snapshot.wallet_address);
            baselineSnapshots.set(snapshot.wallet_address, snapshot);
        }

        for (const snapshot of latestSnapshotsJSON) {
            latestSnapshots.set(snapshot.wallet_address, snapshot);
        }

        const results = smartMoneyAnalyzer.batchAnalyzeBySnapshotDelta(
            unAnalyzedWallets,
            baselineSnapshots,
            latestSnapshots);

        const smartMoneyCount = results.filter(r => r.category !== SmartMoneyCategory.NORMAL).length;

        console.log("results", results.length, "smartMoneyCount", smartMoneyCount);
    });


    test("test for the dailySmartMoneyAnalysis", async () => {
        const smartMoneyAnalyzer = new SmartMoneyAnalyzer();
        const results = await smartMoneyAnalyzer.dailySmartMoneyAnalysis();
        console.log("results", results.length);
        writeTextFileSync("dailySmartMoneyAnalysisResults.json", JSON.stringify(results, null, 2));
    });
});