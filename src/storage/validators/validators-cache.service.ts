import { Inject, Injectable } from '@nestjs/common';
import { mkdir, open, writeFile } from 'node:fs/promises';
import * as path from 'path';
import { LOGGER_PROVIDER, LoggerService } from '../../common/logger';
import { ValidatorsStorageService } from './validators.service';
import { BigNumber } from '@ethersproject/bignumber';
import { stringifyFrameBalances } from '../../common/validators/strigify-frame-balances';

@Injectable()
export class ValidatorsCacheService {
  static CACHE_FILE_NAME = 'validators-state.txt';
  static CACHE_DIR = 'cache';
  static CACHE_DATA_DIVIDER = '|';
  static SERVICE_LOG_NAME = 'validators cache';
  static CACHE_INVALIDATE_TIME = 3 * 3600; // 3 hours

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly validatorsStorage: ValidatorsStorageService,
  ) {}

  public async initializeFromCache() {
    const cacheFileName = this.getCacheFileName();
    try {
      this.logger.log(`try initialize from cache file ${cacheFileName}`, {
        service: ValidatorsCacheService.SERVICE_LOG_NAME,
      });
      const file = await open(cacheFileName);
      const fileReadResult = await file.readFile({ encoding: 'utf-8' });
      await file.close();
      const data: string[] = fileReadResult.split(ValidatorsCacheService.CACHE_DATA_DIVIDER);

      if (data.length !== 4) {
        this.logger.log(`invalid cache data length`, {
          service: ValidatorsCacheService.SERVICE_LOG_NAME,
          data,
        });
        return;
      }

      const lastUpdate = Number(data[2]);
      const now = Math.floor(Date.now() / 1000);
      const isDataValid = now - lastUpdate < ValidatorsCacheService.CACHE_INVALIDATE_TIME;

      if (!isDataValid) {
        this.logger.log(`found outdated cache, skip initialization from cache`, {
          service: ValidatorsCacheService.SERVICE_LOG_NAME,
          data,
        });
        return;
      }

      this.validatorsStorage.setActiveValidatorsCount(Number(data[0]));
      this.validatorsStorage.setMaxExitEpoch(data[1]);
      this.validatorsStorage.setFrameBalances(this.parseFrameBalances(data[3]));
      this.validatorsStorage.setLastUpdate(Number(data[2]));

      this.logger.log(`success initialize from cache file ${cacheFileName}`, {
        service: ValidatorsCacheService.SERVICE_LOG_NAME,
        data,
      });
    } catch (e) {
      this.logger.error(e, { service: ValidatorsCacheService.SERVICE_LOG_NAME });
      this.logger.log(`failed to initialize from file ${cacheFileName}`, {
        service: ValidatorsCacheService.SERVICE_LOG_NAME,
      });
    }
  }

  public async saveDataToCache() {
    const cacheFileName = this.getCacheFileName();
    this.logger.log(`try save to file ${cacheFileName}`, { service: ValidatorsCacheService.SERVICE_LOG_NAME });

    await mkdir(ValidatorsCacheService.CACHE_DIR, { recursive: true });
    const data = [
      this.validatorsStorage.getActiveValidatorsCount(),
      this.validatorsStorage.getMaxExitEpoch(),
      this.validatorsStorage.getLastUpdate(),
      stringifyFrameBalances(this.validatorsStorage.getFrameBalances()),
    ].join(ValidatorsCacheService.CACHE_DATA_DIVIDER);
    await writeFile(cacheFileName, data);
    this.logger.log(`success save to file ${cacheFileName}`, { service: ValidatorsCacheService.SERVICE_LOG_NAME });
  }

  protected getCacheFileName = () => {
    return path.join(ValidatorsCacheService.CACHE_DIR, ValidatorsCacheService.CACHE_FILE_NAME);
  };

  protected parseFrameBalances(frameBalancesStr: string) {
    const frameBalances = JSON.parse(frameBalancesStr);
    return Object.keys(frameBalances).reduce((acc, key) => {
      return { ...acc, [key]: BigNumber.from(frameBalances[key]) };
    }, {});
  }
}
