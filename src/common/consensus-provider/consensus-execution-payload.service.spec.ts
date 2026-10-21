import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConsensusService as ConsensusProviderService } from '@lido-nestjs/consensus';
import { ConsensusExecutionPayloadService } from './consensus-execution-payload.service';
import { SpecService } from '../spec/spec.service';

const REF_SLOT = 200;
const HEAD_SLOT = 210;

const legacyBlock = (slot: number, blockHash: string) => ({
  data: {
    message: { slot: String(slot), body: { execution_payload: { block_number: '67890', block_hash: blockHash } } },
  },
});

const gloasBlock = (slot: number, parentBlockHash: string) => ({
  data: {
    message: {
      slot: String(slot),
      body: { signed_execution_payload_bid: { message: { parent_block_hash: parentBlockHash } } },
    },
  },
});

const notFound = () => new HttpException('Not found', HttpStatus.NOT_FOUND);

describe('ConsensusExecutionPayloadService', () => {
  let moduleRef: TestingModule;
  let service: ConsensusExecutionPayloadService;
  let getBlockV2: jest.Mock;
  let isGlamsterdamReleasedAtSlot: jest.Mock;

  beforeEach(async () => {
    getBlockV2 = jest.fn();
    isGlamsterdamReleasedAtSlot = jest.fn();

    moduleRef = await Test.createTestingModule({
      providers: [
        ConsensusExecutionPayloadService,
        { provide: ConsensusProviderService, useValue: { getBlockV2 } },
        { provide: SpecService, useValue: { isGlamsterdamReleasedAtSlot } },
      ],
    }).compile();

    service = moduleRef.get<ConsensusExecutionPayloadService>(ConsensusExecutionPayloadService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe('before Glamsterdam', () => {
    beforeEach(() => isGlamsterdamReleasedAtSlot.mockReturnValue(false));

    it('anchors to the payload embedded in the ref slot block', async () => {
      getBlockV2.mockResolvedValue(legacyBlock(REF_SLOT, '0xref'));

      await expect(service.getReportAnchorBlockHash(REF_SLOT, HEAD_SLOT)).resolves.toBe('0xref');
      expect(getBlockV2).toHaveBeenCalledTimes(1);
      expect(getBlockV2).toHaveBeenCalledWith({ blockId: String(REF_SLOT) });
      expect(isGlamsterdamReleasedAtSlot).toHaveBeenCalledWith(REF_SLOT);
    });

    it('fails when the ref slot block has no embedded payload', async () => {
      getBlockV2.mockResolvedValue({ data: { message: { slot: String(REF_SLOT), body: {} } } });

      await expect(service.getReportAnchorBlockHash(REF_SLOT, HEAD_SLOT)).rejects.toThrow(
        `Failed to get execution payload for block with slot ${REF_SLOT}`,
      );
    });
  });

  describe('after Glamsterdam', () => {
    beforeEach(() => isGlamsterdamReleasedAtSlot.mockReturnValue(true));

    // The ref slot payload is applied only when the next block builds on it, so the anchor is
    // the EL parent committed in that next block's bid, as the accounting oracle reads it.
    it('anchors to the bid parent of the first block after the ref slot', async () => {
      getBlockV2.mockResolvedValue(gloasBlock(REF_SLOT + 1, '0xparent'));

      await expect(service.getReportAnchorBlockHash(REF_SLOT, HEAD_SLOT)).resolves.toBe('0xparent');
      expect(getBlockV2).toHaveBeenCalledTimes(1);
      expect(getBlockV2).toHaveBeenCalledWith({ blockId: String(REF_SLOT + 1) });
    });

    it('skips missed slots after the ref slot', async () => {
      getBlockV2
        .mockRejectedValueOnce(notFound())
        .mockRejectedValueOnce(notFound())
        .mockResolvedValueOnce(gloasBlock(REF_SLOT + 3, '0xparent'));

      await expect(service.getReportAnchorBlockHash(REF_SLOT, HEAD_SLOT)).resolves.toBe('0xparent');
      expect(getBlockV2.mock.calls.map(([args]) => args.blockId)).toEqual(['201', '202', '203']);
    });

    it('fails when no block follows the ref slot up to the head', async () => {
      getBlockV2.mockRejectedValue(notFound());

      await expect(service.getReportAnchorBlockHash(REF_SLOT, REF_SLOT + 2)).rejects.toThrow(
        `No block after slot ${REF_SLOT} up to slot ${REF_SLOT + 2}`,
      );
      expect(getBlockV2).toHaveBeenCalledTimes(2);
    });

    it('does not query blocks when the head is still at the ref slot', async () => {
      await expect(service.getReportAnchorBlockHash(REF_SLOT, REF_SLOT)).rejects.toThrow('No block after slot');
      expect(getBlockV2).not.toHaveBeenCalled();
    });

    it('propagates errors other than a missed slot', async () => {
      getBlockV2.mockRejectedValue(new HttpException('Unavailable', HttpStatus.SERVICE_UNAVAILABLE));

      await expect(service.getReportAnchorBlockHash(REF_SLOT, HEAD_SLOT)).rejects.toThrow('Unavailable');
      expect(getBlockV2).toHaveBeenCalledTimes(1);
    });

    it('fails when the next block carries no execution payload bid', async () => {
      getBlockV2.mockResolvedValue(legacyBlock(REF_SLOT + 1, '0xembedded'));

      await expect(service.getReportAnchorBlockHash(REF_SLOT, HEAD_SLOT)).rejects.toThrow(
        `Block at slot ${REF_SLOT + 1} has no execution payload bid`,
      );
    });
  });
});
