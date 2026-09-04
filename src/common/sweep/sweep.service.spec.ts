import { SweepService } from './sweep.service';
import { IndexedValidator } from 'common/consensus-provider/consensus-provider.types';
import { FAR_FUTURE_EPOCH } from 'common/constants';

jest.mock('common/config', () => ({}));

describe('SweepService', () => {
  const logger = { log: jest.fn() };
  const genesisTimeService = { getSlotsPerEpoch: jest.fn().mockReturnValue(32) };

  // fully withdrawable at epoch 100: exited, withdrawable, non-zero balance
  const makeWithdrawableValidator = (index: number): IndexedValidator =>
    ({
      index: `${index}`,
      balance: '32000000000',
      status: 'withdrawal_possible',
      validator: {
        effective_balance: '32000000000',
        exit_epoch: '50',
        withdrawable_epoch: '60',
        withdrawal_credentials: '0x01' + '00'.repeat(31),
      },
    } as any);

  const createService = (consensusClientService: any) =>
    new SweepService(logger as any, consensusClientService, genesisTimeService as any);

  const currentEpoch = 100;
  // 16384 withdrawable validators / 16 per payload / 32 slots per epoch = 32 epochs,
  // halved to the mean position in the cycle = 16
  const validators = Array.from({ length: 16384 }, (_, i) => makeWithdrawableValidator(i));

  it('predicts the pre-Gloas cycle from partials and the validator sweep only', async () => {
    const consensusClientService = { getPendingPartialWithdrawals: jest.fn().mockResolvedValue([]) };
    const service = createService(consensusClientService);

    await expect(service.getSweepDelayInEpochs(validators, currentEpoch)).resolves.toBe(16);
  });

  it('lengthens the cycle by Gloas builder payments and exited builders running ahead of validators', async () => {
    const consensusClientService = { getPendingPartialWithdrawals: jest.fn().mockResolvedValue([]) };
    const service = createService(consensusClientService);

    // Together, 16384 builder withdrawals double the entries in the shared budget.
    await expect(
      service.getSweepDelayInEpochs(validators, currentEpoch, { pending: 8192, exited: 8192 }),
    ).resolves.toBe(32);
  });

  it('treats an absent builder queue as empty', async () => {
    const consensusClientService = { getPendingPartialWithdrawals: jest.fn().mockResolvedValue([]) };
    const service = createService(consensusClientService);

    const withDefault = await service.getSweepDelayInEpochs(validators, currentEpoch);
    const withZero = await service.getSweepDelayInEpochs(validators, currentEpoch, { pending: 0, exited: 0 });

    expect(withDefault).toBe(withZero);
  });

  it('ignores validators that are not withdrawable', async () => {
    const consensusClientService = { getPendingPartialWithdrawals: jest.fn().mockResolvedValue([]) };
    const service = createService(consensusClientService);

    const activeValidator = {
      index: '1',
      balance: '32000000000',
      status: 'active_ongoing',
      validator: {
        effective_balance: '32000000000',
        exit_epoch: FAR_FUTURE_EPOCH.toString(),
        withdrawable_epoch: FAR_FUTURE_EPOCH.toString(),
        withdrawal_credentials: '0x01' + '00'.repeat(31),
      },
    } as any;

    await expect(service.getSweepDelayInEpochs([activeValidator], currentEpoch)).resolves.toBe(0);
  });
});
