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
  // Positional pipe-delimited format. Bumping length invalidates older caches on first
  // boot — they self-heal on the next live validators-job pass. Layout (in order):
  //   0: activeValidatorsCount
  //   1: maxExitEpoch
  //   2: lastUpdate
  //   3: frameBalances (JSON)
  //   4: sweepMeanEpochs
  //   5: churnLimit (legacy 32-ETH-equivalent count)
  //   6: exitChurnPerEpochGwei            (EIP-8080)
  //   7: consolidationChurnPerEpochGwei   (EIP-8080)
  //   8: earliestExitEpoch                (EIP-8080)
  //   9: earliestConsolidationEpoch       (EIP-8080)
  static CACHE_DATA_LENGTH = 10;
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

      if (data.length !== ValidatorsCacheService.CACHE_DATA_LENGTH) {
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
      this.validatorsStorage.setLastUpdate(Number(data[2]));
      this.validatorsStorage.setFrameBalances(this.parseFrameBalances(data[3]));
      this.validatorsStorage.setSweepMeanEpochs(Number(data[4]));
      this.validatorsStorage.setChurnLimit(Number(data[5]));
      this.validatorsStorage.setExitChurnPerEpochGwei(this.parseBigNumberOrNull(data[6]));
      this.validatorsStorage.setConsolidationChurnPerEpochGwei(this.parseBigNumberOrNull(data[7]));
      this.validatorsStorage.setEarliestExitEpoch(this.parseStringOrNull(data[8]));
      this.validatorsStorage.setEarliestConsolidationEpoch(this.parseStringOrNull(data[9]));

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
      this.validatorsStorage.getSweepMeanEpochs(),
      this.validatorsStorage.getChurnLimit(),
      this.serializeBigNumberOrNull(this.validatorsStorage.getExitChurnPerEpochGwei()),
      this.serializeBigNumberOrNull(this.validatorsStorage.getConsolidationChurnPerEpochGwei()),
      this.serializeStringOrNull(this.validatorsStorage.getEarliestExitEpoch()),
      this.serializeStringOrNull(this.validatorsStorage.getEarliestConsolidationEpoch()),
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

  // Sentinel "null" string used for optional EIP-8080 fields not yet populated. Avoids
  // empty-segment ambiguity in the pipe-delimited format.
  protected static NULL_SENTINEL = 'null';

  protected serializeBigNumberOrNull(value: BigNumber | null): string {
    return value === null ? ValidatorsCacheService.NULL_SENTINEL : value.toString();
  }

  protected parseBigNumberOrNull(raw: string): BigNumber | null {
    if (raw === ValidatorsCacheService.NULL_SENTINEL || raw === '' || raw == null) return null;
    return BigNumber.from(raw);
  }

  protected serializeStringOrNull(value: string | null): string {
    return value === null ? ValidatorsCacheService.NULL_SENTINEL : value;
  }

  protected parseStringOrNull(raw: string): string | null {
    if (raw === ValidatorsCacheService.NULL_SENTINEL || raw === '' || raw == null) return null;
    return raw;
  }
}
