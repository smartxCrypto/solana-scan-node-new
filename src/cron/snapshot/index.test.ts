import { SnapshotScheduler } from "./index";
import { SolanaBlockDataHandler } from "../../service/SolanaBlockDataHandler";
import { filterSwapDataForTokenTrading } from "../../snap-shot";

describe("Snapshot Scheduler", () => {
    jest.setTimeout(100000);
    test("test the snapshot token number at specific interval", async () => {
        const snapShotSpcificTimeWindow = {
            start: 349053301,
            end: 349053307
        }
        const txData = await SolanaBlockDataHandler.getDataByBlockHeightRange(snapShotSpcificTimeWindow.start, snapShotSpcificTimeWindow.end);

        console.log(" ----- test ------ :got transData number", txData.length);


        const filterData = SolanaBlockDataHandler.filterTokenData(txData);


        console.log(" ----- test ------ :got filterData number", filterData.length);
        const tokenSnapShotData = await filterSwapDataForTokenTrading(filterData);
        console.log(" ----- test ------ :got tokenSnapShotData number", tokenSnapShotData.length);
    });
});