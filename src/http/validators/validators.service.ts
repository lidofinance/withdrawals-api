import { Injectable } from '@nestjs/common';
import { ConfigService } from 'common/config';
import { ValidatorsStorageService } from '../../storage';

@Injectable()
export class ValidatorsService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly validatorsServiceStorage: ValidatorsStorageService,
  ) {}

  getAllValidatorsInfo() {
    const lastUpdatedAt = this.validatorsServiceStorage.getLastUpdate();
    const maxExitEpoch = Number(this.validatorsServiceStorage.getMaxExitEpoch());
    const frameBalancesBigNumber = this.validatorsServiceStorage.getFrameBalances();
    const totalValidators = this.validatorsServiceStorage.getTotal();

    const frameBalances = Object.keys(frameBalancesBigNumber).reduce((acc, item) => {
      acc[item] = frameBalancesBigNumber[item].toString();
      return acc;
    }, {} as Record<string, string>);

    return {
      lastUpdatedAt,
      maxExitEpoch,
      frameBalances,
      totalValidators,
    };
  }
}
