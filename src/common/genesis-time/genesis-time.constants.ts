export const SECONDS_PER_SLOT = 12;
export const SLOTS_PER_EPOCH = 32;
export const EPOCH_PER_FRAME = 225;

// See https://github.com/lidofinance/lido-dao/blob/feature/shapella-upgrade/contracts/0.8.9/sanity_checks/OracleReportSanityChecker.sol#L73-L75
// and https://research.lido.fi/t/withdrawals-for-lido-on-ethereum-bunker-mode-design-and-implementation/3890/4
export const REQUEST_TIMESTAMP_MARGIN = 7680 * 1000; // 2 hours rounded to epoch length
export const GAP_AFTER_REPORT = 30 * 60 * 1000; // 30 mins
