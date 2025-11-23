import { Connection } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../constant/config";

class SOLANA_CONNECT {
    private connection: Connection;

    constructor() {
        this.connection = new Connection(SOLANA_RPC_URL || "");
    }

    public getConnection() {
        return this.connection;
    }

}

const solana_connect_instance = new SOLANA_CONNECT();

export default solana_connect_instance;