import { TransactionAdapter } from '@/collection/parser/transaction-adapter';
import { ClassifiedInstruction, DexInfo, MemeEvent, PumpswapEvent, TradeInfo, TransferData } from '@/type';
import { BaseParser } from '../base-parser';
import { PumpfunEventParser } from './event';
import { getPumpfunTradeInfo } from './util';

export class PumpfunParser extends BaseParser {
  private eventParser: PumpfunEventParser;

  constructor(
    adapter: TransactionAdapter,
    dexInfo: DexInfo,
    transferActions: Record<string, TransferData[]>,
    classifiedInstructions: ClassifiedInstruction[]
  ) {
    super(adapter, dexInfo, transferActions, classifiedInstructions);
    this.eventParser = new PumpfunEventParser(adapter, transferActions);
  }

  public processTrades(): TradeInfo[] {
    const events = this.eventParser
      .parseInstructions(this.classifiedInstructions)
      .filter((event: MemeEvent) => event.type == 'BUY' || event.type == 'SELL');

    return events.map((event: MemeEvent) => this.createTradeInfo(event));
  }

  private createTradeInfo(event: MemeEvent): TradeInfo {

    const trade = getPumpfunTradeInfo(event, {
      slot: this.adapter.slot,
      signature: this.adapter.signature,
      timestamp: event.timestamp,
      idx: event.idx,
      dexInfo: this.dexInfo,
    });

    return this.utils.attachTokenTransferInfo(trade, this.transferActions);
  }
}
