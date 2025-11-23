export interface UserTokenTransfer {
    userAddress: string;
    targetAddress: string;
    tokenAddress: string;
    tokenSymbol: string;
    tokenAmount: number;
    transferTime: number;
    txHash: string;
}