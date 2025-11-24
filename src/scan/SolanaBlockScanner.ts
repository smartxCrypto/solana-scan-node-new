// src/scan/SolanaBlockScanner
import { SolanaBlockUtil } from "../utils/SolanaBlockUtil";
import { CommitmentLevel, SubscribeRequest } from "@triton-one/yellowstone-grpc";
import { SUBSCRIBE_DEX_ADDRESSES } from "@/constant";
import { LaserstreamConfig, subscribe } from "helius-laserstream";
import dotenv from "dotenv";
import { BlockDataSerializer } from "@/scan/BlockDataSerializer";
import { writeFileSync } from "fs";

dotenv.config();

export class SolanaBlockScanner {
    private isRunning = false;
    private subscriptionRequest: SubscribeRequest = {
        transactions: {
        },
        commitment: CommitmentLevel.CONFIRMED,
        accounts: {},
        slots: {},
        transactionsStatus: {},
        blocks: {
            dex: {
                accountInclude: SUBSCRIBE_DEX_ADDRESSES,
                includeTransactions: true,
                includeAccounts: false,
                includeEntries: true
            }
        },
        blocksMeta: {},
        entry: {},
        accountsDataSlice: [],
        // Optionally, you can replay missed data by specifying a fromSlot:
        // fromSlot: '224339000'
        // Note: Currently, you can only replay data from up to 3000 slots in the past.
    };

    public start() {
        this.processBlockWithGrpc();
    }


    private async processBlockWithGrpc(): Promise<void> {
        const config: LaserstreamConfig = {
            apiKey: process.env.HELIUS_LASER_STREAM_API_KEY || '',
            endpoint: process.env.HELIUS_LASER_STREAM_API || '',
        }

        const latestHeight = await SolanaBlockUtil.getLatestSlot();

        if (latestHeight > 0) {
            this.subscriptionRequest.fromSlot = String(latestHeight);
        }

        let receiveLastTime = Date.now();
        let i = 0;

        await subscribe(config, this.subscriptionRequest, async (res) => {
            const blockData = res.block;
            console.log(`${i} ---> receive slot:${res.block?.slot} cost:${Date.now() - receiveLastTime} ms`);
            receiveLastTime = Date.now();
            if (!blockData) {
                return;
            }

            // const fileName = `block_data_${Number(res.block?.slot)}.json`;
            // writeFileSync(fileName, JSON.stringify(blockData, null, 2));

            const handleStart = Date.now();
            // await blockQueue.add({ blockData, slot: Number(res.block?.slot) });
            // SolanaBlockDataHandler.handleBlockData(blockData, Number(res.block?.slot));
            // redisClient.set(REDIS_KEY_LAST_BLOCK, String(Number(res.block?.slot) + 1));
            BlockDataSerializer.storeBlockDataToRedis(blockData, Number(res.block?.slot));
            console.log(`${i} ---> handle slot:${res.block?.slot} cost:${Date.now() - handleStart} ms`);
            i++;
        }, async (error) => {
            console.error(error);
        });
    }


    public stop() {

    }

}

const scanner = new SolanaBlockScanner();
scanner.start();