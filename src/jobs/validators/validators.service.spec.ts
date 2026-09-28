jest.mock('common/config', () => ({ ConfigService: class {} }));

import { ValidatorsService } from './validators.service';

type JobMethod = 'updateValidators' | 'updateLidoWithdrawableValidators';

describe('ValidatorsService jobs', () => {
  it.each<[JobMethod, JobMethod]>([
    ['updateValidators', 'updateLidoWithdrawableValidators'],
    ['updateLidoWithdrawableValidators', 'updateValidators'],
  ])('does not overlap %s and %s', async (firstMethod, secondMethod) => {
    let releaseFirst: () => void;
    let notifyFirstStarted: () => void;
    const firstFinished = new Promise<void>((resolve) => (releaseFirst = resolve));
    const firstStarted = new Promise<void>((resolve) => (notifyFirstStarted = resolve));
    const startedJobs: string[] = [];
    const jobService = {
      wrapJob: jest.fn(async ({ name }: { name: string }) => {
        startedJobs.push(name);
        if (startedJobs.length === 1) {
          notifyFirstStarted();
          await firstFinished;
        }
      }),
    };
    const service = new ValidatorsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      jobService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    ) as unknown as Record<JobMethod, () => Promise<void>>;

    const first = service[firstMethod]();
    await firstStarted;
    const second = service[secondMethod]();

    expect(startedJobs).toHaveLength(1);

    releaseFirst();
    await Promise.all([first, second]);
    expect(startedJobs).toHaveLength(2);
  });
});
