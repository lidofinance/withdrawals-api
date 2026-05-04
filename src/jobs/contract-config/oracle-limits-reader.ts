import { Inject, Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';
import { Interface, id } from 'ethers';
import { LIDO_LOCATOR_CONTRACT_TOKEN, LidoLocator } from '@lido-nestjs/contracts';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import {
  LEGACY_LIMITS_WORD_COUNT,
  LEGACY_ORACLE_REPORT_LIMITS_ABI,
  SRV3_LIMITS_WORD_COUNT,
  SRV3_ORACLE_REPORT_LIMITS_ABI,
} from 'common/contracts/abi/oracle-report-sanity-checker.abi';

/**
 * Subset of `OracleReportSanityChecker.getOracleReportLimits()` that wq-api consumes,
 * unified into post-SR-3-shape units regardless of which on-chain version returned them.
 *
 * - `requestTimestampMargin` is in seconds.
 * - `maxBalanceExitRequestedPerReportInEth` is in whole ETH (NOT wei).
 *   Legacy is converted via the lossless identity `validatorExitCount × 32 ETH = ETH`.
 */
export interface UnifiedOracleReportLimits {
  requestTimestampMargin: BigNumber;
  maxBalanceExitRequestedPerReportInEth: BigNumber;
}

const LEGACY_ETH_PER_VALIDATOR_EXIT = 32;

// Range validation mirrors the on-chain `_checkLimitValue` bounds in OracleReportSanityChecker:
// both fields explicitly allow 0 — `_checkLimitValue(value, 0, type(uintN).max)` — as a
// legitimate governance state (cap=0 freezes VEBO exits; margin=0 disables postponement).
// Compare with peer fields like `maxEffectiveBalanceWeightWCType01/02` and `maxPositiveTokenRebase`
// where the protocol uses min=1 because zero would break contract logic — these don't.
//
// Site B handles maxBalanceExitRequestedPerReportInEth=0 explicitly (skips the exitValidators
// case) so we don't need to artificially exclude it here.
//
// Upper bound on cap matches the on-chain uint16 cast: `SafeCast.toUint16(...)` after the
// _checkLimitValue. Margin's on-chain bound is type(uint32).max ≈ 136 years, which is
// meaningless; cap practically at 24h since governance has no reason to exceed that.
const MAX_BALANCE_EXIT_MIN_ETH = 0;
const MAX_BALANCE_EXIT_MAX_ETH = 65_535; // type(uint16).max
const REQUEST_TIMESTAMP_MARGIN_MIN_SEC = 0;
const REQUEST_TIMESTAMP_MARGIN_MAX_SEC = 86_400; // 24h, well below the contract's uint32 ceiling

const GET_ORACLE_REPORT_LIMITS_SELECTOR = id('getOracleReportLimits()').slice(0, 10);

const LEGACY_INTERFACE = new Interface(LEGACY_ORACLE_REPORT_LIMITS_ABI);
const SRV3_INTERFACE = new Interface(SRV3_ORACLE_REPORT_LIMITS_ABI);

type SanityCheckerVersion = 'legacy' | 'srv3';

/**
 * Resolves OracleReportSanityChecker via `LidoLocator.oracleReportSanityChecker()` (so
 * non-proxy address rotations land automatically), discriminates the on-chain `LimitsList`
 * shape by raw return-data length, decodes with the appropriate ABI fragment, and unifies
 * the result into post-SR-3-shape units.
 *
 * Caches `address → version` after the first observation. Logs at `warn` when a previously
 * unseen address shows up while the cache is non-empty (= protocol just rotated the contract).
 */
@Injectable()
export class OracleLimitsReader {
  static SERVICE_LOG_NAME = 'oracle-limits-reader';

  private readonly versionByAddress = new Map<string, SanityCheckerVersion>();

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    @Inject(LIDO_LOCATOR_CONTRACT_TOKEN) protected readonly lidoLocator: LidoLocator,
  ) {}

  public async read(): Promise<UnifiedOracleReportLimits> {
    const address = (await this.lidoLocator.oracleReportSanityChecker()).toLowerCase();
    const data = await this.provider.call({ to: address, data: GET_ORACLE_REPORT_LIMITS_SELECTOR });
    const version = this.detectVersion(address, data);
    const limits = this.decode(version, data);
    this.validateRanges(limits);
    return limits;
  }

  private detectVersion(address: string, data: string): SanityCheckerVersion {
    const cached = this.versionByAddress.get(address);
    if (cached !== undefined) {
      return cached;
    }

    // hex string '0x' + 64 chars per uint256 word
    const wordCount = (data.length - 2) / 64;
    let version: SanityCheckerVersion;
    if (wordCount >= SRV3_LIMITS_WORD_COUNT) {
      version = 'srv3';
    } else if (wordCount >= LEGACY_LIMITS_WORD_COUNT) {
      version = 'legacy';
    } else {
      throw new Error(
        `Unexpected getOracleReportLimits response from ${address}: wordCount=${wordCount} ` +
          `(expected >= ${LEGACY_LIMITS_WORD_COUNT})`,
      );
    }

    if (this.versionByAddress.size > 0) {
      // a previously-known reader is now seeing a new address — protocol rotated
      this.logger.warn('OracleReportSanityChecker address rotated', {
        service: OracleLimitsReader.SERVICE_LOG_NAME,
        previousAddresses: Array.from(this.versionByAddress.keys()),
        newAddress: address,
        detectedVersion: version,
        wordCount,
      });
    } else {
      this.logger.log('OracleReportSanityChecker version detected', {
        service: OracleLimitsReader.SERVICE_LOG_NAME,
        address,
        version,
        wordCount,
      });
    }

    this.versionByAddress.set(address, version);
    return version;
  }

  private decode(version: SanityCheckerVersion, data: string): UnifiedOracleReportLimits {
    if (version === 'srv3') {
      const [decoded] = SRV3_INTERFACE.decodeFunctionResult('getOracleReportLimits', data);
      return {
        requestTimestampMargin: BigNumber.from(decoded.requestTimestampMargin.toString()),
        maxBalanceExitRequestedPerReportInEth: BigNumber.from(decoded.maxBalanceExitRequestedPerReportInEth.toString()),
      };
    }
    const [decoded] = LEGACY_INTERFACE.decodeFunctionResult('getOracleReportLimits', data);
    return {
      requestTimestampMargin: BigNumber.from(decoded.requestTimestampMargin.toString()),
      // legacy lossless identity: count × 32 ETH/validator = ETH
      maxBalanceExitRequestedPerReportInEth: BigNumber.from(decoded.maxValidatorExitRequestsPerReport.toString()).mul(
        LEGACY_ETH_PER_VALIDATOR_EXIT,
      ),
    };
  }

  private validateRanges(limits: UnifiedOracleReportLimits): void {
    const margin = limits.requestTimestampMargin.toNumber();
    if (margin < REQUEST_TIMESTAMP_MARGIN_MIN_SEC || margin > REQUEST_TIMESTAMP_MARGIN_MAX_SEC) {
      throw new Error(
        `requestTimestampMargin out of range: ${margin}s ` +
          `(expected ${REQUEST_TIMESTAMP_MARGIN_MIN_SEC}..${REQUEST_TIMESTAMP_MARGIN_MAX_SEC})`,
      );
    }
    const cap = limits.maxBalanceExitRequestedPerReportInEth.toNumber();
    if (cap < MAX_BALANCE_EXIT_MIN_ETH || cap > MAX_BALANCE_EXIT_MAX_ETH) {
      throw new Error(
        `maxBalanceExitRequestedPerReportInEth out of range: ${cap} ETH ` +
          `(expected ${MAX_BALANCE_EXIT_MIN_ETH}..${MAX_BALANCE_EXIT_MAX_ETH})`,
      );
    }
  }
}
