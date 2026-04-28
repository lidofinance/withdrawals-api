import { Injectable } from '@nestjs/common';

@Injectable()
export class ContractConfigStorageService {
  protected requestTimestampMargin: number;
  protected initialEpoch: number;
  protected epochsPerFrameVEBO: number;
  protected epochsPerFrame: number;
  protected maxValidatorExitRequestsPerReport: number;
  protected accountingOracleAddress: string;
  protected withdrawalVaultAddress: string;
  protected elRewardsVaultAddress: string;
  protected lastUpdate: number;

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

  public getEpochsPerFrame() {
    return this.epochsPerFrame;
  }

  public setEpochsPerFrame(epochsPerFrame: number) {
    this.epochsPerFrame = epochsPerFrame;
  }

  public getMaxValidatorExitRequestsPerReport() {
    return this.maxValidatorExitRequestsPerReport;
  }

  public setMaxValidatorExitRequestsPerReport(maxValidatorExitRequestsPerReport: number) {
    this.maxValidatorExitRequestsPerReport = maxValidatorExitRequestsPerReport;
  }

  public getAccountingOracleAddress() {
    return this.accountingOracleAddress;
  }

  public setAccountingOracleAddress(accountingOracleAddress: string) {
    this.accountingOracleAddress = accountingOracleAddress;
  }

  public getWithdrawalVaultAddress() {
    return this.withdrawalVaultAddress;
  }

  public setWithdrawalVaultAddress(withdrawalVaultAddress: string) {
    this.withdrawalVaultAddress = withdrawalVaultAddress;
  }

  public getElRewardsVaultAddress() {
    return this.elRewardsVaultAddress;
  }

  public setElRewardsVaultAddress(elRewardsVaultAddress: string) {
    this.elRewardsVaultAddress = elRewardsVaultAddress;
  }

  public setLastUpdate(lastUpdate: number) {
    this.lastUpdate = lastUpdate;
  }

  public getLastUpdate() {
    return this.lastUpdate;
  }
}
