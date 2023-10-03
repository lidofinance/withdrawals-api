import { Inject, Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';
import { InfuraProvider } from '@ethersproject/providers';
import { LOGGER_PROVIDER, LoggerService } from '../../../common/logger';
import {
  Lido,
  LIDO_CONTRACT_TOKEN,
  LIDO_LOCATOR_CONTRACT_TOKEN,
  LidoLocator,
  WITHDRAWAL_QUEUE_CONTRACT_TOKEN,
  WithdrawalQueue,
} from '@lido-nestjs/contracts';
import { QueueInfoStorageService, ValidatorsStorageService } from '../../../storage';
import { ConfigService } from '../../../common/config';
import { ConsensusProviderService } from '../../../common/consensus-provider';
import { buildBlockstamp } from './utils/build-blockstamp';
import { BlockStamp, LidoReportRebase, ReferenceBlockStamp } from './bunker.types';
import { ACCOUNTING_ORACLE_TOKEN } from '../../../common/contracts/accounting-oracle/accounting-oracle.constants';
import { AccountingOracle, Burner } from '../../../common/contracts/generated';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { BURNER_TOKEN } from '../../../common/contracts/burner/burner.constants';

@Injectable()
export class BunkerService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly withdrawal: WithdrawalQueue,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly lido: Lido,
    @Inject(ACCOUNTING_ORACLE_TOKEN) protected readonly accountingOracle: AccountingOracle,
    @Inject(LIDO_LOCATOR_CONTRACT_TOKEN) protected readonly lidoLocator: LidoLocator,
    @Inject(BURNER_TOKEN) protected readonly burner: Burner,
    protected readonly configService: ConfigService,
    protected readonly validatorStorage: ValidatorsStorageService,
    protected readonly consensusProviderService: ConsensusProviderService,
    protected readonly queueInfoStorageService: QueueInfoStorageService,
    protected readonly simpleFallbackJsonRpcBatchProvider: SimpleFallbackJsonRpcBatchProvider,
  ) {}

  // def is_bunker_mode(
  //     self,
  //     blockstamp: ReferenceBlockStamp,
  //     frame_config: FrameConfig,
  //     chain_config: ChainConfig,
  //     simulated_cl_rebase: LidoReportRebase,
  // ) -> bool:
  //     """If any of cases is True, then bunker mode is ON"""
  //     bunker_config = self._get_config(blockstamp)
  //     all_validators = self.w3.cc.get_validators(blockstamp)
  //     lido_validators = self.w3.lido_validators.get_lido_validators(blockstamp)
  //
  //     # Set metrics
  //     ALL_VALIDATORS.set(len(all_validators))
  //     LIDO_VALIDATORS.set(len(lido_validators))
  //     ALL_SLASHED_VALIDATORS.set(len(filter_slashed_validators(all_validators)))
  //     LIDO_SLASHED_VALIDATORS.set(len(filter_slashed_validators(lido_validators)))
  //
  //     last_report_ref_slot = self.w3.lido_contracts.get_accounting_last_processing_ref_slot(blockstamp)
  //     # If it is the very first run, we don't check bunker mode
  //     if not last_report_ref_slot:
  //         logger.info({"msg": "No one report yet. Bunker status will not be checked"})
  //         return False
  //
  //     logger.info({"msg": "Checking bunker mode"})
  //
  //     current_report_cl_rebase = self.get_cl_rebase_for_current_report(blockstamp, simulated_cl_rebase)
  //     if current_report_cl_rebase < 0:
  //         logger.info({"msg": "Bunker ON. CL rebase is negative"})
  //         return True
  //
  //     high_midterm_slashing_penalty = MidtermSlashingPenalty.is_high_midterm_slashing_penalty(
  //         blockstamp, frame_config, chain_config, all_validators, lido_validators, current_report_cl_rebase, last_report_ref_slot
  //     )
  //     if high_midterm_slashing_penalty:
  //         logger.info({"msg": "Bunker ON. High midterm slashing penalty"})
  //         return True
  //
  //     abnormal_cl_rebase = AbnormalClRebase(self.w3, chain_config, bunker_config).is_abnormal_cl_rebase(
  //         blockstamp, all_validators, lido_validators, current_report_cl_rebase
  //     )
  //     if abnormal_cl_rebase:
  //         logger.info({"msg": "Bunker ON. Abnormal CL rebase"})
  //         return True
  //
  //     return False

  public async isBunker(blockstamp: ReferenceBlockStamp) {
    // const simulatedClRebase = await this.simulateClRebase(blockstamp);
    //
    // if (simulatedClRebase < 0) {
    //   console.log('negative cl rebase');
    //   return true;
    // }
  }

  simulateClRebase(blockstamp: ReferenceBlockStamp) {
    return this.simulateRebaseAfterReport(blockstamp, BigNumber.from(0));
  }

  // def simulate_rebase_after_report(
  //     self,
  //     blockstamp: ReferenceBlockStamp,
  //     el_rewards: Wei,
  // ) -> LidoReportRebase:
  //     """
  //     To calculate how much withdrawal request protocol can finalize - needs finalization share rate after this report
  //     """
  //     validators_count, cl_balance = self._get_consensus_lido_state(blockstamp)
  //
  //     chain_conf = self.get_chain_config(blockstamp)
  //
  //     simulated_tx = self.w3.lido_contracts.lido.functions.handleOracleReport(
  //         # We use block timestamp, instead of slot timestamp,
  //         # because missed slot will break simulation contract logics
  //         # Details: https://github.com/lidofinance/lido-oracle/issues/291
  //         blockstamp.block_timestamp,  # _reportTimestamp
  //         self._get_slots_elapsed_from_last_report(blockstamp) * chain_conf.seconds_per_slot,  # _timeElapsed
  //         # CL values
  //         validators_count,  # _clValidators
  //         Web3.to_wei(cl_balance, 'gwei'),  # _clBalance
  //         # EL values
  //         self.w3.lido_contracts.get_withdrawal_balance(blockstamp),  # _withdrawalVaultBalance
  //         el_rewards,  # _elRewardsVaultBalance
  //         self.get_shares_to_burn(blockstamp),  # _sharesRequestedToBurn
  //         # Decision about withdrawals processing
  //         [],  # _lastFinalizableRequestId
  //         0,  # _simulatedShareRate
  //     )
  //
  //     logger.info({'msg': 'Simulate lido rebase for report.', 'value': simulated_tx.args})
  //
  //     result = simulated_tx.call(
  //         transaction={'from': self.w3.lido_contracts.accounting_oracle.address},
  //         block_identifier=blockstamp.block_hash,
  //     )
  //
  //     logger.info({'msg': 'Fetch simulated lido rebase for report.', 'value': result})
  //
  //     return LidoReportRebase(*result)
  public async simulateRebaseAfterReport(blockstamp: ReferenceBlockStamp, elReward: BigNumber) {
    const [count, totalBalance] = this.getConsensusLidoState();
    const chainConfig = this.queueInfoStorageService.getChainConfig();
    const slotsElapsed = await this.getSlotsElapsedFromLastReport(blockstamp);
    const withdrawalBalance = await this.getWithdrawalBalance();
    const sharesToBurn = await this.getSharesToBurn();
    const tx = await this.lido.handleOracleReport(
      blockstamp.block_timestamp,
      slotsElapsed.mul(chainConfig.secondsPerSlot),
      count,
      totalBalance,
      withdrawalBalance,
      elReward,
      sharesToBurn,
      [],
      BigNumber.from(0),
    );

    // tx.
  }

  // def _get_slots_elapsed_from_last_report(self, blockstamp: ReferenceBlockStamp):
  //         chain_conf = self.get_chain_config(blockstamp)
  //         frame_config = self.get_frame_config(blockstamp)
  //
  //         last_ref_slot = self.w3.lido_contracts.get_accounting_last_processing_ref_slot(blockstamp)
  //
  //         if last_ref_slot:
  //             slots_elapsed = blockstamp.ref_slot - last_ref_slot
  //         else:
  //             slots_elapsed = blockstamp.ref_slot - frame_config.initial_epoch * chain_conf.slots_per_epoch
  //
  //         return slots_elapsed

  public async getSlotsElapsedFromLastReport(blockstamp: ReferenceBlockStamp) {
    const chainConfig = this.queueInfoStorageService.getChainConfig();
    const frameConfig = this.queueInfoStorageService.getFrameConfig();

    const lastRefSlot = await this.getAccountingLastProcessingRefSlot(blockstamp);
    let slotsElapsed: BigNumber;
    if (lastRefSlot.gt(0)) {
      slotsElapsed = blockstamp.ref_slot.sub(lastRefSlot);
    } else {
      slotsElapsed = blockstamp.ref_slot.sub(frameConfig.initialEpoch.mul(chainConfig.slotsPerEpoch));
    }

    return slotsElapsed;
  }

  getConsensusLidoState() {
    const lidoValidators = this.validatorStorage.getLidoValidators();
    const totalBalance = lidoValidators.reduce((acc, v) => {
      return acc.add(BigNumber.from(v.balance));
    }, BigNumber.from(0));

    this.logger.debug(`Calculate consensus lido state. ${lidoValidators.length}, ${totalBalance}`);
    return [lidoValidators.length, totalBalance];
  }

  async receiveLastFinalizedSlot(): Promise<BlockStamp> {
    const rootBlock = await this.consensusProviderService.getBlockRoot({
      blockId: 'finalized',
    });
    const blockDetails = await this.consensusProviderService.getBlockV2({
      blockId: rootBlock.data.root,
    });

    return buildBlockstamp(blockDetails.data);
  }

  async getClRebaseForCurrentReport(blockstamp: BlockStamp, simulatedClRebase: LidoReportRebase) {
    const beforeReportTotalPolledEther = await this.getTotalSupply(blockstamp);
    const frameClRebase = BigNumber.from(simulatedClRebase.post_total_pooled_ether).sub(beforeReportTotalPolledEther);
    return frameClRebase;
  }

  async getTotalSupply(blockstamp: BlockStamp) {
    return this.lido.totalSupply({ blockTag: blockstamp.block_hash });
  }

  async getAccountingLastProcessingRefSlot(blockstamp: BlockStamp) {
    return await this.accountingOracle.getLastProcessingRefSlot({ blockTag: blockstamp.block_hash });
  }

  async getWithdrawalBalance() {
    const address = await this.lidoLocator.withdrawalVault();
    return await this.simpleFallbackJsonRpcBatchProvider.getBalance(address);
  }

  async getSharesToBurn() {
    const { coverShares, nonCoverShares } = await this.burner.getSharesRequestedToBurn();
    return coverShares.add(nonCoverShares);
  }
}
