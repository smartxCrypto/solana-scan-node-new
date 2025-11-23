import {SolanaBlockDataHandler} from "@/service/SolanaBlockDataHandler";

SolanaBlockDataHandler.start();

process.on("SIGINT", () => {
    console.log("[Signal] 收到 SIGINT");
    SolanaBlockDataHandler.stop();
});

process.on("SIGTERM", () => {
    console.log("[Signal] 收到 SIGTERM");
    SolanaBlockDataHandler.stop();
});