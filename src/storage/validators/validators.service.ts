import { Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';

@Injectable()
export class ValidatorsStorageService {
  protected maxExitEpoch: string;
  protected activeValidatorsCount: number;
  protected totalValidatorsCount: number;
  protected lastUpdate: number;
  protected frameBalances: Record<string, BigNumber>;
  protected sweepMeanEpochs: number;
  protected churnLimit: number;
  protected withdrawableLidoValidatorIds: string[] = [];

  // EIP-8080 inputs. Populated by the validators job from beacon-state and from the
  // total-active-balance derivation (see get-churn-limit utils). Default to null so the
  // waiting-time engine can fall back to the legacy formula until the job has run once.
  protected exitChurnPerEpochGwei: BigNumber | null = null;
  protected consolidationChurnPerEpochGwei: BigNumber | null = null;
  protected earliestExitEpoch: string | null = null;
  protected earliestConsolidationEpoch: string | null = null;

  /**
   * Get max exit epoch for all validators
   * @returns max exit epoch string
   */
  public getMaxExitEpoch(): string {
    return this.maxExitEpoch;
  }

  /**
   * Get total validators
   * @returns total validators number
   */
  public getActiveValidatorsCount(): number {
    return this.activeValidatorsCount;
  }

  /**
   * Get last update timestamp
   * @returns last update timestamp
   */
  public getLastUpdate(): number | null {
    return this.lastUpdate;
  }

  /**
   * Updates max exit epoch for all validators
   * @param maxExitEpoch - max exit epoch string
   */
  public setMaxExitEpoch(maxExitEpoch: string): void {
    this.maxExitEpoch = maxExitEpoch;
  }

  /**
   * Updates total validators
   * @param activeValidatorsCount - total validators number
   */
  public setActiveValidatorsCount(activeValidatorsCount: number): void {
    this.activeValidatorsCount = activeValidatorsCount;
  }

  /**
   * Updates last update timestamp
   * @param lastUpdate - timestamp to save
   */
  public setLastUpdate(lastUpdate: number): void {
    this.lastUpdate = lastUpdate;
  }

  /**
   * Get frame balances
   * @returns frame balances
   */
  public getFrameBalances() {
    return this.frameBalances;
  }

  /**
   * Updates frame balances
   * @param frameBalances - frame balances
   */
  public setFrameBalances(frameBalances: Record<string, BigNumber>): void {
    this.frameBalances = frameBalances;
  }

  public setTotalValidatorsCount(totalValidatorsCount: number) {
    this.totalValidatorsCount = totalValidatorsCount;
  }

  public getTotalValidatorsCount() {
    return this.totalValidatorsCount;
  }

  public setSweepMeanEpochs(sweepMeanEpochs: number) {
    this.sweepMeanEpochs = sweepMeanEpochs;
  }

  public getSweepMeanEpochs() {
    return this.sweepMeanEpochs;
  }

  public setChurnLimit(churnLimit: number) {
    this.churnLimit = churnLimit;
  }

  public getChurnLimit() {
    return this.churnLimit;
  }

  public setWithdrawableLidoValidatorIds(withdrawableLidoValidators: string[]) {
    this.withdrawableLidoValidatorIds = withdrawableLidoValidators;
  }

  public getWithdrawableLidoValidatorIds() {
    return this.withdrawableLidoValidatorIds;
  }

  public setExitChurnPerEpochGwei(value: BigNumber | null) {
    this.exitChurnPerEpochGwei = value;
  }

  public getExitChurnPerEpochGwei(): BigNumber | null {
    return this.exitChurnPerEpochGwei;
  }

  public setConsolidationChurnPerEpochGwei(value: BigNumber | null) {
    this.consolidationChurnPerEpochGwei = value;
  }

  public getConsolidationChurnPerEpochGwei(): BigNumber | null {
    return this.consolidationChurnPerEpochGwei;
  }

  public setEarliestExitEpoch(value: string | null) {
    this.earliestExitEpoch = value;
  }

  public getEarliestExitEpoch(): string | null {
    return this.earliestExitEpoch;
  }

  public setEarliestConsolidationEpoch(value: string | null) {
    this.earliestConsolidationEpoch = value;
  }

  public getEarliestConsolidationEpoch(): string | null {
    return this.earliestConsolidationEpoch;
  }
}
