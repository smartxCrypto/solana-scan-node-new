import { DEX_PROGRAMS, DISCRIMINATORS } from '@/constant';
import { TradeInfo } from '@/type';
import { getInstructionData, getProgramName } from '@/lib/utils';
import { BaseParser } from '@/collection/parser/base-parser';

export class OrcaParser extends BaseParser {
  public processTrades(): TradeInfo[] {
    const trades: TradeInfo[] = [];

    this.classifiedInstructions.forEach(({ instruction, programId, outerIndex, innerIndex }) => {
      if (DEX_PROGRAMS.ORCA.id === programId && this.notLiquidityEvent(instruction)) {
        const transfers = this.getTransfersForInstruction(programId, outerIndex, innerIndex);
        if (transfers.length >= 2) {
          const trade = this.utils.processSwapData(transfers, {
            ...this.dexInfo,
            amm: this.dexInfo.amm || getProgramName(programId),
          });
          if (trade) {
            trades.push(this.utils.attachTokenTransferInfo(trade, this.transferActions));
          }
        }
      }
    });

    return trades;
  }

  private notLiquidityEvent(instruction: any): boolean {
    if (instruction.data) {
      const instructionType = getInstructionData(instruction).slice(0, 8);
      return !Object.values(DISCRIMINATORS.ORCA).some((it) => instructionType.equals(it));
    }
    return true;
  }
}
