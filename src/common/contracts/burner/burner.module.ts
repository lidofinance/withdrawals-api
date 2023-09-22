import { Module } from '@nestjs/common';
import { BURNER_TOKEN, BURNER_ADDRESSES } from './burner.constants';
import { HashConsensus__factory } from '../generated';
import { ContractModule } from '@lido-nestjs/contracts';

@Module({})
export class BurnerModule extends ContractModule {
  static module = BurnerModule;
  static contractFactory = HashConsensus__factory;
  static contractToken = BURNER_TOKEN;
  static defaultAddresses = BURNER_ADDRESSES;
}
