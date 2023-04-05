import { Injectable } from '@nestjs/common';

@Injectable()
export class ValidatorsStorageService {
  protected maxExitEpoch: string;
  protected total: number;
  protected lastUpdate: number;

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
  public getTotal(): number {
    return this.total;
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
   * @param total - total validators number
   */
  public setTotal(total: number): void {
    this.total = total;
  }

  /**
   * Updates last update timestamp
   * @param lastUpdate - timestamp to save
   */
  public setLastUpdate(lastUpdate: number): void {
    this.lastUpdate = lastUpdate;
  }
}
