import { Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';

@Injectable()
export class RewardsStorageService {
  protected rewardsPerFrame: BigNumber = BigNumber.from(0);
  protected clRewardsPerFrame: BigNumber = BigNumber.from(0);
  protected elRewardsPerFrame: BigNumber = BigNumber.from(0);

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
    return this.clRewardsPerFrame;
  }

  public setClRewardsPerFrame(clRewardsPerFrame: BigNumber) {
    this.clRewardsPerFrame = clRewardsPerFrame;
  }
}
