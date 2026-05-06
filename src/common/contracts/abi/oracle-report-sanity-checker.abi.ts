/**
 * ABI fragments for OracleReportSanityChecker.getOracleReportLimits().
 *
 * Two shapes coexist on-chain:
 * - LEGACY: 12-field LimitsList from pre-SR-3 (mainnet today, Hoodi pre-SR-3).
 * - SRV3: 16-field LimitsList from feat/staking-router-3.0 (Hoodi today).
 *
 * The new contract is a fresh deploy at a new address (non-proxy, no SELFDESTRUCT). The
 * OracleLimitsReader resolves the address via LidoLocator and discriminates by raw
 * return-data length: 12 × 32 = 384 bytes (legacy) vs 16 × 32 = 512 bytes (SRV3). Both
 * shapes use uint256 in the public ABI regardless of internal packed widths, so wire
 * encoding is one 32-byte word per field.
 *
 * Position-shift summary (relevant to silent-corruption hazard if a partial package bump
 * ever points the legacy ABI at the SRV3 contract):
 * - position 4: legacy maxValidatorExitRequestsPerReport (count) → SRV3 maxBalanceExitRequestedPerReportInEth (ETH)
 * - position 7: legacy requestTimestampMargin (sec) → SRV3 maxItemsPerExtraDataTransaction (count)
 */

export const LEGACY_ORACLE_REPORT_LIMITS_ABI = [
  {
    name: 'getOracleReportLimits',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: 'limitsList',
        type: 'tuple',
        components: [
          { name: 'exitedValidatorsPerDayLimit', type: 'uint256' },
          { name: 'appearedValidatorsPerDayLimit', type: 'uint256' },
          { name: 'annualBalanceIncreaseBPLimit', type: 'uint256' },
          { name: 'simulatedShareRateDeviationBPLimit', type: 'uint256' },
          { name: 'maxValidatorExitRequestsPerReport', type: 'uint256' },
          { name: 'maxItemsPerExtraDataTransaction', type: 'uint256' },
          { name: 'maxNodeOperatorsPerExtraDataItem', type: 'uint256' },
          { name: 'requestTimestampMargin', type: 'uint256' },
          { name: 'maxPositiveTokenRebase', type: 'uint256' },
          { name: 'initialSlashingAmountPWei', type: 'uint256' },
          { name: 'inactivityPenaltiesAmountPWei', type: 'uint256' },
          { name: 'clBalanceOraclesErrorUpperBPLimit', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

export const SRV3_ORACLE_REPORT_LIMITS_ABI = [
  {
    name: 'getOracleReportLimits',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: 'limitsList',
        type: 'tuple',
        components: [
          { name: 'exitedEthAmountPerDayLimit', type: 'uint256' },
          { name: 'appearedEthAmountPerDayLimit', type: 'uint256' },
          { name: 'annualBalanceIncreaseBPLimit', type: 'uint256' },
          { name: 'simulatedShareRateDeviationBPLimit', type: 'uint256' },
          { name: 'maxBalanceExitRequestedPerReportInEth', type: 'uint256' },
          { name: 'maxEffectiveBalanceWeightWCType01', type: 'uint256' },
          { name: 'maxEffectiveBalanceWeightWCType02', type: 'uint256' },
          { name: 'maxItemsPerExtraDataTransaction', type: 'uint256' },
          { name: 'maxNodeOperatorsPerExtraDataItem', type: 'uint256' },
          { name: 'requestTimestampMargin', type: 'uint256' },
          { name: 'maxPositiveTokenRebase', type: 'uint256' },
          { name: 'maxCLBalanceDecreaseBP', type: 'uint256' },
          { name: 'clBalanceOraclesErrorUpperBPLimit', type: 'uint256' },
          { name: 'consolidationEthAmountPerDayLimit', type: 'uint256' },
          { name: 'exitedValidatorEthAmountLimit', type: 'uint256' },
          { name: 'externalPendingBalanceCapEth', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

/** Number of uint256 words in the legacy LimitsList tuple (= 12 × 32 = 384 bytes on the wire). */
export const LEGACY_LIMITS_WORD_COUNT = 12;

/** Number of uint256 words in the SRV3 LimitsList tuple (= 16 × 32 = 512 bytes on the wire). */
export const SRV3_LIMITS_WORD_COUNT = 16;
