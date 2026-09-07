import { ValidatorsService } from './validators.service';
import { MAINNET_CHURN_SPEC_PARAMS } from '../../common/spec/churn-spec-params';

jest.mock('common/config', () => ({}));
jest.mock('jobs/validators/utils/validators-stream', () => ({
  processValidatorsStream: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { processValidatorsStream } = require('jobs/validators/utils/validators-stream');

describe('ValidatorsService.updateValidators', () => {
  const logger = { log: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

  const activeValidator = {
    index: '1',
    balance: '32000000000',
    status: 'active_ongoing',
    validator: {
      pubkey: '0xaa',
      effective_balance: '32000000000',
      exit_epoch: '18446744073709551615',
      withdrawable_epoch: '18446744073709551615',
      withdrawal_credentials: '0x01' + '00'.repeat(31),
    },
  };

  const createMocks = () => ({
    prometheus: {},
    consensusProvider: { getStateValidatorsStream: jest.fn().mockResolvedValue('stream') },
    consensusClient: {
      getStateSweepData: jest.fn().mockResolvedValue({
        slot: '85206',
        next_withdrawal_validator_index: '148',
        builder_pending_withdrawals_count: 2,
        exited_builder_withdrawals_count: 1,
      }),
    },
    consensusRetry: {
      execute: jest.fn(async (_operation, callback) => callback()),
    },
    config: { get: jest.fn() },
    // mirrors JobService.wrapJob: errors are caught, never re-thrown
    jobService: {
      wrapJob: jest.fn(async (_meta, cb) => {
        try {
          await cb();
        } catch (error) {
          logger.error(error);
        }
      }),
    },
    storage: {
      setActiveValidatorsCount: jest.fn(),
      setExitChurnLimit: jest.fn(),
      setConsolidationChurnLimit: jest.fn(),
      setTotalValidatorsCount: jest.fn(),
      setMaxExitEpoch: jest.fn(),
      setSweepMeanEpochs: jest.fn(),
      setLastUpdate: jest.fn(),
      setFrameBalances: jest.fn(),
      setWithdrawableLidoValidatorIds: jest.fn(),
      getTotalValidatorsCount: jest.fn().mockReturnValue(1),
      getActiveValidatorsCount: jest.fn().mockReturnValue(1),
      getFrameBalances: jest.fn().mockReturnValue({}),
    },
    cache: { saveDataToCache: jest.fn() },
    genesisTime: {
      getCurrentEpoch: jest.fn().mockReturnValue(252025),
      getFrameOfEpoch: jest.fn().mockReturnValue(1),
      getFrameByTimestamp: jest.fn().mockReturnValue(1),
      getSlotsPerEpoch: jest.fn().mockReturnValue(32),
      getSecondsPerSlot: jest.fn().mockReturnValue(12),
    },
    lidoKeys: {
      fetchLidoKeysData: jest.fn().mockResolvedValue({ data: [] }),
      getLidoValidatorsByKeys: jest.fn().mockResolvedValue([]),
    },
    sweep: { getSweepDelayInEpochs: jest.fn().mockResolvedValue(7) },
    spec: {
      isGlamsterdamReleasedAtEpoch: jest.fn().mockReturnValue(false),
      getChurnSpecParams: jest.fn().mockReturnValue(MAINNET_CHURN_SPEC_PARAMS),
    },
  });

  const createService = (mocks: ReturnType<typeof createMocks>) =>
    new ValidatorsService(
      logger as any,
      mocks.prometheus as any,
      mocks.consensusProvider as any,
      mocks.consensusClient as any,
      mocks.consensusRetry as any,
      mocks.config as any,
      mocks.jobService as any,
      mocks.storage as any,
      mocks.cache as any,
      mocks.genesisTime as any,
      mocks.lidoKeys as any,
      mocks.sweep as any,
      mocks.spec as any,
    );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('threads builder payment and exited-builder counts into the sweep estimate', async () => {
    const mocks = createMocks();
    processValidatorsStream.mockResolvedValue([activeValidator]);
    const service = createService(mocks);

    await (service as any).updateValidators();

    expect(mocks.sweep.getSweepDelayInEpochs).toHaveBeenCalledWith([activeValidator], 252025, {
      pending: 2,
      exited: 1,
    });
    expect(mocks.consensusClient.getStateSweepData).toHaveBeenCalledWith('head', 252025, false);
    expect(mocks.storage.setSweepMeanEpochs).toHaveBeenCalledWith(7);
    expect(mocks.storage.setExitChurnLimit).toHaveBeenCalledWith(4);
    expect(mocks.storage.setConsolidationChurnLimit).toHaveBeenCalledWith(0);
    expect(mocks.storage.setLastUpdate).toHaveBeenCalled();
    expect(mocks.cache.saveDataToCache).toHaveBeenCalled();
  });

  it('leaves every storage untouched when the beacon-state fetch fails', async () => {
    const mocks = createMocks();
    processValidatorsStream.mockResolvedValue([activeValidator]);
    mocks.consensusClient.getStateSweepData.mockRejectedValue(new Error('CL unavailable'));
    const service = createService(mocks);

    await (service as any).updateValidators();

    expect(mocks.storage.setSweepMeanEpochs).not.toHaveBeenCalled();
    expect(mocks.storage.setExitChurnLimit).not.toHaveBeenCalled();
    expect(mocks.storage.setConsolidationChurnLimit).not.toHaveBeenCalled();
    expect(mocks.storage.setMaxExitEpoch).not.toHaveBeenCalled();
    expect(mocks.storage.setLastUpdate).not.toHaveBeenCalled();
    expect(mocks.cache.saveDataToCache).not.toHaveBeenCalled();
  });
});
