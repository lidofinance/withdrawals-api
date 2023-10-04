import { Injectable } from '@nestjs/common';

@Injectable()
export class ContractConfigStorageService {
  protected requestTimestampMargin: number;
  protected initialEpoch: number;

  public getRequestTimestampMargin() {
    return this.requestTimestampMargin;
  }

  public setRequestTimestampMargin(requestTimestampMargin: number) {
    this.requestTimestampMargin = requestTimestampMargin;
  }

  public getInitialEpoch() {
    return this.initialEpoch;
  }

  public setInitialEpoch(initialEpoch: number) {
    this.initialEpoch = initialEpoch;
  }
}
