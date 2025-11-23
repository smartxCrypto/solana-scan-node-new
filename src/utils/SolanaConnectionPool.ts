// utils/SolanaConnectionPool
import { Connection } from "@solana/web3.js";

const rpcArray = [
    "https://solana-mainnet.core.chainstack.com/18462a49342e3ef0f64835c002a078a5",
    "https://mainnet.helius-rpc.com/?api-key=3ed35a0b-35f6-4adb-8caa-5c72cd36b023",

];

export class SolanaConnectionPool {
    private static connections: Connection[] = rpcArray.map(
        (rpc) => new Connection(rpc, {
            commitment: "confirmed",
        })
    );

    /**
     * 根据索引获取连接对象（支持循环取模）
     * @param index
     * @returns Connection 实例
     */
    public static getConnection(index: number): Connection {
        const len = SolanaConnectionPool.connections.length;
        if (len === 0) {
            throw new Error("Connection pool is empty.");
        }
        return SolanaConnectionPool.connections[index % len];
    }

    /**
     * 获取连接池长度
     */
    public static getPoolSize(): number {
        return SolanaConnectionPool.connections.length;
    }
}