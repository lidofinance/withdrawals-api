import { Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';

@Injectable()
export class RewardsStorageService {
  protected rewardsPerFrame: BigNumber;
  protected clRewardsPerFrame: BigNumber;
  protected elRewardsPerFrame: BigNumber;

  public getRewardsPerFrame() {
    return this.rewardsPerFrame;
  }

  public setRewardsPerFrame(rewardsPerFrame: BigNumber) {
    this.rewardsPerFrame = rewardsPerFrame;
  }

  public getElRewardsPerFrame() {
    return this.elRewardsPerFrame;
  }

  public setElRewardsPerFrame(elRewardsPerFrame: BigNumber) {
    this.elRewardsPerFrame = elRewardsPerFrame;
  }

  public getClRewardsPerFrame() {
    return this.elRewardsPerFrame;
  }

  public setClRewardsPerFrame(clRewardsPerFrame: BigNumber) {
    this.clRewardsPerFrame = clRewardsPerFrame;
  }
}
