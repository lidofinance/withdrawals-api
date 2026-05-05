jest.mock('common/config', () => ({}));

import { OracleLimitsReader } from './oracle-limits-reader';

const ADDR_A = '0x049a972e9cbefffc1c2543dfd0fa892c2e9ed6c5';
const ADDR_B = '0x53417ba942bc86492baf46faba8769f246422388';

const encodeUint256 = (v: number | bigint): string =>
  (typeof v === 'bigint' ? v : BigInt(v)).toString(16).padStart(64, '0');

const encodeTuple = (values: (number | bigint)[]): string => '0x' + values.map(encodeUint256).join('');

// SRV3 16-field tuple matching Hoodi-deployed values (deployed-hoodi.json:759-774).
// Position 4 = maxBalanceExitRequestedPerReportInEth, position 9 = requestTimestampMargin.
const SRV3_TUPLE_HOODI = [
  57_600, // exitedEthAmountPerDayLimit
  57_600, // appearedEthAmountPerDayLimit
  1_000, // annualBalanceIncreaseBPLimit
  50, // simulatedShareRateDeviationBPLimit
  19_200, // maxBalanceExitRequestedPerReportInEth
  32, // maxEffectiveBalanceWeightWCType01
  2_048, // maxEffectiveBalanceWeightWCType02
  8, // maxItemsPerExtraDataTransaction
  24, // maxNodeOperatorsPerExtraDataItem
  7_200, // requestTimestampMargin
  750_000, // maxPositiveTokenRebase
  360, // maxCLBalanceDecreaseBP
  50, // clBalanceOraclesErrorUpperBPLimit
  93_375, // consolidationEthAmountPerDayLimit
  32, // exitedValidatorEthAmountLimit
  300, // externalPendingBalanceCapEth
];

// Legacy 12-field tuple matching pre-SR-3 mainnet shape. maxValidatorExitRequestsPerReport=600
// (position 4) lossless-converts to 19,200 ETH via × 32 — identical to SRV3 above.
const LEGACY_TUPLE_MAINNET = [
  9_000, // exitedValidatorsPerDayLimit
  43_200, // appearedValidatorsPerDayLimit
  1_000, // annualBalanceIncreaseBPLimit
  50, // simulatedShareRateDeviationBPLimit
  600, // maxValidatorExitRequestsPerReport
  8, // maxItemsPerExtraDataTransaction
  24, // maxNodeOperatorsPerExtraDataItem
  7_200, // requestTimestampMargin
  750_000, // maxPositiveTokenRebase
  1_000, // initialSlashingAmountPWei
  101, // inactivityPenaltiesAmountPWei
  50, // clBalanceOraclesErrorUpperBPLimit
];

describe('OracleLimitsReader', () => {
  let reader: OracleLimitsReader;
  let provider: { call: jest.Mock };
  let locator: { oracleReportSanityChecker: jest.Mock };
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    provider = { call: jest.fn() };
    locator = { oracleReportSanityChecker: jest.fn() };
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    reader = new OracleLimitsReader(logger as any, provider as any, locator as any);
  });

  it('decodes SRV3 response (16-word tuple) and reads named fields directly', async () => {
    locator.oracleReportSanityChecker.mockResolvedValue(ADDR_A);
    provider.call.mockResolvedValue(encodeTuple(SRV3_TUPLE_HOODI));

    const result = await reader.read();

    expect(result.requestTimestampMargin.toNumber()).toBe(7_200);
    expect(result.maxBalanceExitRequestedPerReportInEth.toNumber()).toBe(19_200);
    expect(logger.log).toHaveBeenCalledWith(
      'OracleReportSanityChecker version detected',
      expect.objectContaining({ address: ADDR_A.toLowerCase(), version: 'srv3', wordCount: 16 }),
    );
  });

  it('decodes legacy response (12-word tuple) with × 32 ETH conversion', async () => {
    locator.oracleReportSanityChecker.mockResolvedValue(ADDR_B);
    provider.call.mockResolvedValue(encodeTuple(LEGACY_TUPLE_MAINNET));

    const result = await reader.read();

    expect(result.requestTimestampMargin.toNumber()).toBe(7_200);
    // legacy lossless identity: 600 validators × 32 ETH = 19,200 ETH
    expect(result.maxBalanceExitRequestedPerReportInEth.toNumber()).toBe(19_200);
    expect(logger.log).toHaveBeenCalledWith(
      'OracleReportSanityChecker version detected',
      expect.objectContaining({ version: 'legacy', wordCount: 12 }),
    );
  });

  it('caches version by address; does not log re-detection on subsequent calls', async () => {
    locator.oracleReportSanityChecker.mockResolvedValue(ADDR_A);
    provider.call.mockResolvedValue(encodeTuple(SRV3_TUPLE_HOODI));

    await reader.read();
    await reader.read();
    await reader.read();

    // version detected log should fire exactly once
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs warn on address rotation (different address than previously cached)', async () => {
    // first call: ADDR_B with legacy shape
    locator.oracleReportSanityChecker.mockResolvedValueOnce(ADDR_B);
    provider.call.mockResolvedValueOnce(encodeTuple(LEGACY_TUPLE_MAINNET));
    await reader.read();

    // second call: ADDR_A with srv3 shape (= simulated SR-3 deploy)
    locator.oracleReportSanityChecker.mockResolvedValueOnce(ADDR_A);
    provider.call.mockResolvedValueOnce(encodeTuple(SRV3_TUPLE_HOODI));
    await reader.read();

    expect(logger.warn).toHaveBeenCalledWith(
      'OracleReportSanityChecker address rotated',
      expect.objectContaining({
        previousAddresses: [ADDR_B.toLowerCase()],
        newAddress: ADDR_A.toLowerCase(),
        detectedVersion: 'srv3',
      }),
    );
  });

  it('throws on requestTimestampMargin above 24h ceiling', async () => {
    locator.oracleReportSanityChecker.mockResolvedValue(ADDR_A);
    const tuple = [...SRV3_TUPLE_HOODI];
    tuple[9] = 100_000; // > 86_400 sec (24h) ceiling
    provider.call.mockResolvedValue(encodeTuple(tuple));

    await expect(reader.read()).rejects.toThrow(/requestTimestampMargin out of range: 100000s/);
  });

  it('throws on maxBalanceExitRequestedPerReportInEth above on-chain uint16.max ceiling', async () => {
    locator.oracleReportSanityChecker.mockResolvedValue(ADDR_A);
    const tuple = [...SRV3_TUPLE_HOODI];
    tuple[4] = 70_000; // > type(uint16).max = 65535 ETH
    provider.call.mockResolvedValue(encodeTuple(tuple));

    await expect(reader.read()).rejects.toThrow(/maxBalanceExitRequestedPerReportInEth out of range: 70000 ETH/);
  });

  it('accepts maxBalanceExitRequestedPerReportInEth=0 as a legitimate VEBO-frozen state', async () => {
    // Per the on-chain _checkLimitValue(_, 0, type(uint16).max), governance can set 0 to halt
    // VEBO exit reports entirely (e.g. emergency lever). Reader passes the value through;
    // Site B handles 0 explicitly by skipping the exitValidators case.
    locator.oracleReportSanityChecker.mockResolvedValue(ADDR_A);
    const tuple = [...SRV3_TUPLE_HOODI];
    tuple[4] = 0;
    provider.call.mockResolvedValue(encodeTuple(tuple));

    const result = await reader.read();
    expect(result.maxBalanceExitRequestedPerReportInEth.toNumber()).toBe(0);
  });

  it('accepts requestTimestampMargin=0 as a legitimate "no postponement" governance state', async () => {
    locator.oracleReportSanityChecker.mockResolvedValue(ADDR_A);
    const tuple = [...SRV3_TUPLE_HOODI];
    tuple[9] = 0;
    provider.call.mockResolvedValue(encodeTuple(tuple));

    const result = await reader.read();
    expect(result.requestTimestampMargin.toNumber()).toBe(0);
  });

  it('throws on unknown word count (e.g., short response)', async () => {
    locator.oracleReportSanityChecker.mockResolvedValue(ADDR_A);
    // 8 words = neither legacy (12) nor SRV3 (16)
    provider.call.mockResolvedValue(encodeTuple([1, 2, 3, 4, 5, 6, 7, 8]));

    await expect(reader.read()).rejects.toThrow(/wordCount=8/);
  });

  it('normalizes addresses to lowercase for cache stability', async () => {
    const upperA = ADDR_A.toUpperCase().replace('0X', '0x');
    locator.oracleReportSanityChecker.mockResolvedValueOnce(upperA);
    provider.call.mockResolvedValueOnce(encodeTuple(SRV3_TUPLE_HOODI));
    await reader.read();

    locator.oracleReportSanityChecker.mockResolvedValueOnce(ADDR_A);
    provider.call.mockResolvedValueOnce(encodeTuple(SRV3_TUPLE_HOODI));
    await reader.read();

    // both calls used the same address modulo case → no rotation warning
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledTimes(1);
  });
});
