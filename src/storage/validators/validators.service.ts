import { Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';

@Injectable()
export class ValidatorsStorageService {
  protected maxExitEpoch: string;
  protected activeValidatorsCount: number;
  protected totalValidatorsCount: number;
  protected lastUpdate: number;
  protected frameBalances: Record<string, BigNumber>;
  protected withdrawableLidoValidators: string[];

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

  public setWithdrawableLidoValidatorIds(withdrawableLidoValidators: string[]) {
    this.withdrawableLidoValidators = withdrawableLidoValidators;
  }

  public getWithdrawableLidoValidatorIds() {
    return this.withdrawableLidoValidators;
  }
}
