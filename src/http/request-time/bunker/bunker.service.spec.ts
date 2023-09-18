import { Test, TestingModule } from '@nestjs/testing';
import { BunkerService } from './bunker.service';

describe('BunkerService', () => {
  let service: BunkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BunkerService],
    }).compile();

    service = module.get<BunkerService>(BunkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
