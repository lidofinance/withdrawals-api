import { ConsensusMethodResult } from '@lido-nestjs/consensus/dist/interfaces/consensus.interface';

export type ResponseValidatorsData = Awaited<ConsensusMethodResult<'getStateValidators'>>['data'];
export type Validator = ResponseValidatorsData[number];
