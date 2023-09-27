import { Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';

@Injectable()
export class RewardsStorageService {
  protected rewardsPerFrame: BigNumber;

  public getRewardsPerFrame() {
    return this.rewardsPerFrame;
  }

  public setRewardsPerFrame(rewardsPerFrame: BigNumber) {
    this.rewardsPerFrame = rewardsPerFrame;
  }
}
