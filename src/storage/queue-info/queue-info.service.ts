import { BigNumber } from '@ethersproject/bignumber';
import { Injectable } from '@nestjs/common';
import { WithdrawalRequest } from './queue-info.types';

@Injectable()
export class QueueInfoStorageService {
  protected unfinalizedStETH: BigNumber;
  protected unfinalizedRequestsCount: BigNumber;
  protected lastUpdate: number;
  protected minStethAmount: BigNumber;
  protected maxStethAmount: BigNumber;
  protected depositableEther: BigNumber;
  protected bufferedEther: BigNumber;
  protected requests: WithdrawalRequest[];

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
  public getUnfinalizedRequestsCount(): BigNumber {
    return this.unfinalizedRequestsCount;
  }

  /**
   * Get last update timestamp
   * @returns last update timestamp
   */
  public getLastUpdate(): number | null {
    return this.lastUpdate;
  }

  /**
   * Get min stETH amount
   * @returns min stETH amount
   */
  public getMinStethAmount(): BigNumber | undefined {
    return this.minStethAmount;
  }

  /**
   * Get max stETH amount
   * @returns max stETH amount
   */
  public getMaxStethAmount(): BigNumber | undefined {
    return this.maxStethAmount;
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
  public setUnfinalizedRequestsCount(unfinalizedRequestsCount: BigNumber): void {
    this.unfinalizedRequestsCount = unfinalizedRequestsCount;
  }

  /**
   * Updates last update timestamp
   * @param lastUpdate - timestamp to save
   * */
  public setLastUpdate(lastUpdate: number): void {
    this.lastUpdate = lastUpdate;
  }

  /**
   * Updates min stETH amount
   * @param minStethAmount - min stETH amount to save
   * */
  public setMinStethAmount(minStethAmount: BigNumber): void {
    this.minStethAmount = minStethAmount;
  }

  /**
   * Updates max stETH amount
   * @param minStethAmount - max stETH amount to save
   * */
  public setMaxStethAmount(maxStethAmount: BigNumber): void {
    this.maxStethAmount = maxStethAmount;
  }

  /**
   * Updates depositable Ether amount
   * @param depositableEther - ether amount in buffer to save
   * */
  public setDepositableEther(depositableEther: BigNumber): void {
    this.depositableEther = depositableEther;
  }

  /**
   * Get depositable Ether amount
   * @returns depositable Ether amount
   */
  public getDepositableEther(): BigNumber | undefined {
    return this.depositableEther;
  }

  public setRequests(requests: WithdrawalRequest[]): void {
    this.requests = requests;
  }

  public getRequests(): WithdrawalRequest[] {
    return this.requests;
  }

  public setBufferedEther(bufferedEther: BigNumber): void {
    this.bufferedEther = bufferedEther;
  }

  public getBufferedEther(): BigNumber | undefined {
    return this.bufferedEther;
  }
}
