import { CHAINS } from '@lido-nestjs/constants';

export const LIDO_ETH_DESTRIBUTED_EVENT =
  'event ETHDistributed(uint256 indexed reportTimestamp, uint256 preCLBalance, uint256 postCLBalance, uint256 withdrawalsWithdrawn, uint256 executionLayerRewardsWithdrawn, uint256 postBufferedEther)';
export const LIDO_EL_REWARDS_RECEIVED_EVENT = 'event ELRewardsReceived(uint256 amount)';
export const LIDO_WITHDRAWALS_RECEIVED_EVENT = 'event WithdrawalsReceived(uint256 amount)';
export const LIDO_TOKEN_REBASED_EVENT =
  'event TokenRebased(uint256 indexed reportTimestamp, uint256 timeElapsed, uint256 preTotalShares, uint256 preTotalEther, uint256 postTotalShares, uint256 postTotalEther, uint256 sharesMintedAsFees)';

export const WITHDRAWAL_VAULT_ADDRESSES = {
  [CHAINS.Mainnet]: '0xb9d7934878b5fb9610b3fe8a5e441e8fad7e293f',
  [CHAINS.Goerli]: '0xdc62f9e8C34be08501Cdef4EBDE0a280f576D762',
  [CHAINS.Holesky]: '0xF0179dEC45a37423EAD4FaD5fCb136197872EAd9',
};
