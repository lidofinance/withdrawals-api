import { Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';

@Injectable()
export class ContractConfigStorageService {
  protected requestTimestampMargin: number;
  protected initialEpoch: number;
  protected epochsPerFrameVEBO: number;
  protected epochsPerFrame: number;
  // Post-SR-3 unit: ETH (whole, not wei). For pre-SR-3 contracts the value is computed via
  // the lossless identity legacy `maxValidatorExitRequestsPerReport × 32 ETH = ETH`.
  protected maxBalanceExitRequestedPerReportInEth: BigNumber;
  // Reflects whether the connected Lido contract has the SR-3 buffer-reserve extension methods.
  // Updated each contract-config tick from LidoExtensionReader.probe(); defaults to false.
  // Once observed true at the reader level, the latch keeps it true (a protocol cannot un-deploy SR-3).
  protected lidoSupportsDepositsReserve = false;
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

  public getMaxBalanceExitRequestedPerReportInEth(): BigNumber {
    return this.maxBalanceExitRequestedPerReportInEth;
  }

  public setMaxBalanceExitRequestedPerReportInEth(maxBalanceExitRequestedPerReportInEth: BigNumber): void {
    this.maxBalanceExitRequestedPerReportInEth = maxBalanceExitRequestedPerReportInEth;
  }

  public getLidoSupportsDepositsReserve(): boolean {
    return this.lidoSupportsDepositsReserve;
  }

  public setLidoSupportsDepositsReserve(lidoSupportsDepositsReserve: boolean): void {
    this.lidoSupportsDepositsReserve = lidoSupportsDepositsReserve;
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
