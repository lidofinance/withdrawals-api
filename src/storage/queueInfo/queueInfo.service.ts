import { BigNumber } from '@ethersproject/bignumber';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QueueInfoStorageService {
  protected unfinalizedStETH: BigNumber;
  protected unfinalizedRequests: BigNumber;
  protected lastUpdate: number;
  protected tokenName: string;
  protected tokenSymbol: string;

  /**
   * Get unfinalized ETH
   * @returns big number
   */
  public getStETH(): BigNumber {
    return this.unfinalizedStETH;
  }

  /**
   * Get unfinalized requests
   * @returns big number
   */
  public getRequests(): BigNumber {
    return this.unfinalizedRequests;
  }

  /**
   * Get last update timestamp
   * @returns last update timestamp
   */
  public getLastUpdate(): number | null {
    return this.lastUpdate;
  }

  /**
   * Get token name
   * @returns token name
   */
  public getTokenName(): string | undefined {
    return this.tokenName;
  }

  /**
   * Get token symbol
   * @returns token symbol
   */
  public getTokenSymbol(): string | undefined {
    return this.tokenSymbol;
  }

  /**
   * Updates unfinalized stETH
   * @param unfinalizedEth - BigNumber stETH to save
   */
  public setStETH(unfinalizedStETH: BigNumber): void {
    this.unfinalizedStETH = unfinalizedStETH;
  }

  /**
   * Updates unfinalized requests
   * @param unfinalizedRequests - BigNumber requests to save
   */
  public setRequests(unfinalizedRequests: BigNumber): void {
    this.unfinalizedRequests = unfinalizedRequests;
  }

  /**
   * Updates last update timestamp
   * @param lastUpdate - timestamp to save
   * */
  public setLastUpdate(lastUpdate: number): void {
    this.lastUpdate = lastUpdate;
  }

  /**
   * Updates token name
   * @param tokenName - token name to save
   * */
  public setTokenName(tokenName: string): void {
    this.tokenName = tokenName;
  }

  /**
   * Updates token symbol
   * @param tokenSymbol - token symbol to save
   * */
  public setTokenSymbol(tokenSymbol: string): void {
    this.tokenSymbol = tokenSymbol;
  }
}
