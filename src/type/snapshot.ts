export enum SnapShotType {
    TokenNormSnapShot = "TokenNormSnapShot",
    SnapShotForWalletTrading = "SnapShotForWalletTrading",
}


export interface SnapshotInfo {
    id?: number;
    timestamp: number;
    type: SnapShotType;
    blockHeight: number;
    blockTime: number;
}
