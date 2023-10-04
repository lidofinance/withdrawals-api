import { Injectable } from '@nestjs/common';

@Injectable()
export class ContractConfigStorageService {
  protected requestTimestampMargin: number;
  protected initialEpoch: number;
  protected epochsPerFrameVEBO: number;
  protected maxValidatorExitRequestsPerReport: number;

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

  public getEpochsPerFrameVEBO() {
    return this.epochsPerFrameVEBO;
  }

  public setEpochsPerFrameVEBO(epochsPerFrameVEBO: number) {
    this.epochsPerFrameVEBO = epochsPerFrameVEBO;
  }

  public getMaxValidatorExitRequestsPerReport() {
    return this.maxValidatorExitRequestsPerReport;
  }

  public setMaxValidatorExitRequestsPerReport(maxValidatorExitRequestsPerReport: number) {
    this.maxValidatorExitRequestsPerReport = maxValidatorExitRequestsPerReport;
  }
}
