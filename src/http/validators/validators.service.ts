import { Injectable } from '@nestjs/common';
import { ConfigService } from 'common/config';
import { ValidatorsStorageService } from '../../storage';
import { GenesisTimeService } from '../../common/genesis-time';

@Injectable()
export class ValidatorsService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly validatorsServiceStorage: ValidatorsStorageService,
    protected readonly genesisTimeService: GenesisTimeService,
  ) {}

  getValidatorsInfo() {
    const lastUpdatedAt = this.validatorsServiceStorage.getLastUpdate();
    const maxExitEpoch = Number(this.validatorsServiceStorage.getMaxExitEpoch());
    const frameBalancesBigNumber = this.validatorsServiceStorage.getFrameBalances();
    const totalValidators = this.validatorsServiceStorage.getActiveValidatorsCount();
    const currentFrame = this.genesisTimeService.getFrameOfEpoch(this.genesisTimeService.getCurrentEpoch());

    const frameBalances = Object.keys(frameBalancesBigNumber).reduce((acc, item) => {
      acc[item] = frameBalancesBigNumber[item].toString();
      return acc;
    }, {} as Record<string, string>);

    if (!lastUpdatedAt) {
      return null;
    }

    return {
      lastUpdatedAt,
      maxExitEpoch,
      frameBalances,
      totalValidators,
      currentFrame,
    };
  }
}
