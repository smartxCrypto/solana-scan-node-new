import { TOKENS, TOKEN_2022_PROGRAM_ID, TOKEN_DECIMALS, TOKEN_PROGRAM_ID } from '../../constant/index';
import { TransactionAdapter } from './transaction-adapter';
import { TransferData, convertToUiAmount } from '../../type/index';
import { getPubkeyString, getTranferTokenMint } from '../../lib/utils';

export const isTransferCheck = (instruction: any): boolean => {
  return (
    (instruction.programId == TOKEN_PROGRAM_ID || instruction.programId == TOKEN_2022_PROGRAM_ID) &&
    instruction.parsed.type.includes('transferChecked')
  );
};

export const isTransfer = (instruction: any): boolean => {
  return (
    instruction.program === 'spl-token' &&
    instruction.programId == TOKEN_PROGRAM_ID &&
    instruction.parsed.type === 'transfer'
  );
};

export const isNativeTransfer = (instruction: any): boolean => {
  return (
    instruction.program === 'system' && instruction.programId == TOKENS.NATIVE && instruction.parsed.type === 'transfer'
  );
};

export const processTransfer = (instruction: any, idx: string, adapter: TransactionAdapter): TransferData | null => {
  const { info } = instruction.parsed;
  if (!info) return null;

  const programId = getPubkeyString(instruction.programId);
  const [token1, token2] = [
    adapter.splTokenMap.get(info.destination)?.mint,
    adapter.splTokenMap.get(info.source)?.mint,
  ];
  if (!token1 && !token2) return null;

  let mint = getTranferTokenMint(token1, token2);

  if (!mint && programId == TOKENS.NATIVE) mint = TOKENS.SOL;
  if (!mint) return null;

  const decimals = adapter.splDecimalsMap.get(mint);
  if (typeof decimals === 'undefined') return null;

  const [sourceBalance, destinationBalance] = adapter.getTokenAccountBalance([info.source, info.destination]);
  const [sourcePreBalance, destinationPreBalance] = adapter.getTokenAccountPreBalance([info.source, info.destination]);

  return {
    type: 'transfer',
    programId: programId,
    info: {
      authority: info.authority,
      destination: info.destination || '',
      destinationOwner: adapter.getTokenAccountOwner(info.destination),
      mint,
      source: info.source || '',
      tokenAmount: {
        amount: info.amount,
        decimals,
        uiAmount: convertToUiAmount(info.amount, decimals),
      },
      sourceBalance: sourceBalance,
      sourcePreBalance: sourcePreBalance,
      destinationBalance: destinationBalance,
      destinationPreBalance: destinationPreBalance,
    },
    idx: idx,
    timestamp: adapter.blockTime,
    signature: adapter.signature,
  };
};

export const processNatvieTransfer = (
  instruction: any,
  idx: string,
  adapter: TransactionAdapter
): TransferData | null => {
  const { info } = instruction.parsed;
  if (!info) return null;

  const programId = getPubkeyString(instruction.programId);
  const mint = TOKENS.SOL;
  const decimals = TOKEN_DECIMALS.SOL;

  const [sourceBalance, destinationBalance] = adapter.getAccountBalance([info.source, info.destination]);
  const [sourcePreBalance, destinationPreBalance] = adapter.getAccountPreBalance([info.source, info.destination]);
  return {
    type: 'transfer',
    programId: programId,
    info: {
      authority: info.authority,
      destination: info.destination || '',
      destinationOwner: adapter.getTokenAccountOwner(info.destination),
      mint,
      source: info.source || '',
      tokenAmount: {
        amount: info.lamports,
        decimals,
        uiAmount: convertToUiAmount(info.lamports, decimals),
      },
      sourceBalance: sourceBalance,
      sourcePreBalance: sourcePreBalance,
      destinationBalance: destinationBalance,
      destinationPreBalance: destinationPreBalance,
    },
    idx: idx,
    timestamp: adapter.blockTime,
    signature: adapter.signature,
  };
};

export const processTransferCheck = (
  instruction: any,
  idx: string,
  adapter: TransactionAdapter
): TransferData | null => {
  const { info } = instruction.parsed;
  if (!info) return null;

  const decimals = adapter.splDecimalsMap.get(info.mint);
  if (typeof decimals === 'undefined') return null;

  const [sourceBalance, destinationBalance] = adapter.getTokenAccountBalance([info.source, info.destination]);
  const [sourcePreBalance, destinationPreBalance] = adapter.getTokenAccountPreBalance([info.source, info.destination]);

  return {
    type: 'transferChecked',
    programId: instruction.programId,
    info: {
      authority: info.authority,
      destination: info.destination || '',
      destinationOwner: adapter.getTokenAccountOwner(info.destination),
      mint: info.mint || '',
      source: info.source || '',
      tokenAmount: info.tokenAmount || {
        amount: info.amount,
        decimals,
        uiAmount: convertToUiAmount(info.amount, decimals),
      },
      sourceBalance: sourceBalance,
      sourcePreBalance: sourcePreBalance,
      destinationBalance: destinationBalance,
      destinationPreBalance: destinationPreBalance,
    },
    idx,
    timestamp: adapter.blockTime,
    signature: adapter.signature,
  };
};

export const isExtraAction = (instruction: any, type: string): boolean => {
  return (
    instruction.program === 'spl-token' && instruction.programId == TOKEN_PROGRAM_ID && instruction.parsed.type === type
  );
};

export const processExtraAction = (
  instruction: any,
  idx: string,
  adapter: TransactionAdapter,
  type: string
): TransferData | null => {
  const { info } = instruction.parsed;
  if (!info) return null;

  const mint = info.mint || adapter.splTokenMap.get(info.destination)?.mint;
  if (!mint) return null;

  const decimals = adapter.splDecimalsMap.get(mint);
  if (typeof decimals === 'undefined') return null;

  const [sourceBalance, destinationBalance] = adapter.getTokenAccountBalance([info.source, info.destination]);
  const [sourcePreBalance, destinationPreBalance] = adapter.getTokenAccountPreBalance([info.source, info.destination]);

  return {
    type: type,
    programId: instruction.programId,
    info: {
      authority: info.authority || info.mintAuthority || '',
      destination: info.destination || '',
      destinationOwner: adapter.getTokenAccountOwner(info.destination),
      mint,
      source: info.source || '',
      tokenAmount: {
        amount: info.amount,
        decimals,
        uiAmount: convertToUiAmount(info.amount, decimals),
      },
      sourceBalance: sourceBalance,
      sourcePreBalance: sourcePreBalance,
      destinationBalance: destinationBalance,
      destinationPreBalance: destinationPreBalance,
    },
    idx: idx,
    timestamp: adapter.blockTime,
    signature: adapter.signature,
  };
};
