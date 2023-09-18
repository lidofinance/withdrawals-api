import { Inject, Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';
import { LOGGER_PROVIDER, LoggerService } from '../../../common/logger';
import { Lido, LIDO_CONTRACT_TOKEN, WITHDRAWAL_QUEUE_CONTRACT_TOKEN, WithdrawalQueue } from '@lido-nestjs/contracts';
import { QueueInfoStorageService } from '../../../storage';
import { ConfigService } from '../../../common/config';
import { JobService } from '../../../common/job';

type BlockStamp = {
  stateRoot: string;
  slot_number: number;
  block_hash: string;
  block_number: number;
  block_timestamp: BigNumber;
};

// Ref slot could differ from slot_number if ref_slot was missed slot_number will be previous first non-missed slot
type ReferenceBlockStamp = BlockStamp & {
  ref_slot: number;
  ref_epoch: number;
};

type LidoReportRebase = {
  post_total_pooled_ether: number;
  post_total_shares: number;
  withdrawals: BigNumber;
  el_reward: BigNumber;
};

@Injectable()
export class BunkerService {
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

  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contractWithdrawal: WithdrawalQueue,
    @Inject(LIDO_CONTRACT_TOKEN) protected readonly contractLido: Lido,
    protected readonly configService: ConfigService,
  ) {}

  public isBunker() {}

  //def simulate_cl_rebase(self, blockstamp: ReferenceBlockStamp) -> LidoReportRebase:
  //         Simulate rebase excluding any execution rewards.
  //         This used to check worst scenarios in bunker service.
  //         return self.simulate_rebase_after_report(blockstamp, el_rewards=Wei(0))
  simulateClRebase(blockstamp: ReferenceBlockStamp) {
    return this.simulateRebaseAfterReport(blockstamp, BigNumber.from(0));
  }

  public simulateRebaseAfterReport(blockstamp: ReferenceBlockStamp, elReward: BigNumber) {
    const tx = await this.contractLido.handleOracleReport(blockstamp.block_timestamp);
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
  public getSlotsElapsedFromLastReport(blockstamp: ReferenceBlockStamp) {
    const lastRefSlot = this.contractLido.acc;
  }

  //def _get_consensus_lido_state(self, blockstamp: ReferenceBlockStamp) -> tuple[int, Gwei]:
  //         lido_validators = self.w3.lido_validators.get_lido_validators(blockstamp)
  //
  //         count = len(lido_validators)
  //         total_balance = Gwei(sum(int(validator.balance) for validator in lido_validators))
  //
  //         logger.info({'msg': 'Calculate consensus lido state.', 'value': (count, total_balance)})
  //         return count, total_balance
}
