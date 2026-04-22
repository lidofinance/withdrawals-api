import { BigNumber } from '@ethersproject/bignumber';
import { QueueInfoService } from './queue-info.service';
import { WithdrawalRequest } from '../../storage/queue-info/queue-info.types';

jest.mock('common/config', () => ({}));

function makeRequest(id: number): WithdrawalRequest {
  return {
    id: BigNumber.from(id),
    amountOfStETH: BigNumber.from(id),
    amountOfShares: BigNumber.from(id),
    owner: '0x0000000000000000000000000000000000000001',
    timestamp: BigNumber.from(id),
    isFinalized: false,
    isClaimed: false,
    0: BigNumber.from(id),
    1: BigNumber.from(id),
    2: '0x0000000000000000000000000000000000000001',
    3: BigNumber.from(id),
    4: false,
    5: false,
  } as WithdrawalRequest;
}

describe('QueueInfoService', () => {
  let service: QueueInfoService;
  let contractWithdrawal: { getWithdrawalStatus: jest.Mock };
  let queueInfoStorageService: { getRequests: jest.Mock };

  beforeEach(() => {
    contractWithdrawal = {
      getWithdrawalStatus: jest.fn(async (ids: BigNumber[]) => ids.map((id) => makeRequest(id.toNumber()))),
    };

    queueInfoStorageService = {
      getRequests: jest.fn(),
    };

    service = new QueueInfoService(
      { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
      contractWithdrawal as any,
      {} as any,
      {} as any,
      queueInfoStorageService as any,
      {} as any,
      {} as any,
    );
  });

  it('keeps cached active requests and fetches only new tail requests', async () => {
    queueInfoStorageService.getRequests.mockReturnValue([makeRequest(10), makeRequest(11), makeRequest(12)]);

    const lastRequestId = BigNumber.from(14);
    const unfinalizedRequests = BigNumber.from(3);

    const result = await (service as any).getUpdatedRequests(lastRequestId, unfinalizedRequests);

    expect(contractWithdrawal.getWithdrawalStatus).toHaveBeenCalledTimes(1);
    expect(contractWithdrawal.getWithdrawalStatus).toHaveBeenCalledWith([BigNumber.from(13), BigNumber.from(14)]);
    expect(result.map((request) => request.id.toNumber())).toEqual([12, 13, 14]);
  });

  it('refetches the full active range when cached requests are not contiguous', async () => {
    queueInfoStorageService.getRequests.mockReturnValue([makeRequest(12), makeRequest(14)]);

    const lastRequestId = BigNumber.from(14);
    const unfinalizedRequests = BigNumber.from(3);

    const result = await (service as any).getUpdatedRequests(lastRequestId, unfinalizedRequests);

    expect(contractWithdrawal.getWithdrawalStatus).toHaveBeenCalledTimes(1);
    expect(contractWithdrawal.getWithdrawalStatus).toHaveBeenCalledWith([
      BigNumber.from(12),
      BigNumber.from(13),
      BigNumber.from(14),
    ]);
    expect(result.map((request) => request.id.toNumber())).toEqual([12, 13, 14]);
  });

  it('drops finalized head requests and appends only the new tail requests', async () => {
    queueInfoStorageService.getRequests.mockReturnValue([
      makeRequest(0),
      makeRequest(1),
      makeRequest(2),
      makeRequest(3),
      makeRequest(4),
      makeRequest(5),
      makeRequest(6),
      makeRequest(7),
      makeRequest(8),
      makeRequest(9),
      makeRequest(10),
    ]);

    const lastRequestId = BigNumber.from(15);
    const unfinalizedRequests = BigNumber.from(13);

    const result = await (service as any).getUpdatedRequests(lastRequestId, unfinalizedRequests);

    expect(contractWithdrawal.getWithdrawalStatus).toHaveBeenCalledTimes(1);
    expect(contractWithdrawal.getWithdrawalStatus).toHaveBeenCalledWith([
      BigNumber.from(11),
      BigNumber.from(12),
      BigNumber.from(13),
      BigNumber.from(14),
      BigNumber.from(15),
    ]);
    expect(result.map((request) => request.id.toNumber())).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });
});
