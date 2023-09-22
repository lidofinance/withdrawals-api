import { Module } from '@nestjs/common';
import { ACCOUNTING_ORACLE_TOKEN, ACCOUNTING_ORACLE_ADDRESSES } from './accounting-oracle.constants';
import { AccountingOracle__factory } from '../generated';
import { ContractModule } from '@lido-nestjs/contracts';

@Module({})
export class AccountingOracleModule extends ContractModule {
  static module = AccountingOracleModule;
  static contractFactory = AccountingOracle__factory;
  static contractToken = ACCOUNTING_ORACLE_TOKEN;
  static defaultAddresses = ACCOUNTING_ORACLE_ADDRESSES;
}
