export type LidoKey = {
  key: string;
  depositSignature: string;
  operatorIndex: number;
  used: boolean;
  moduleAddress: string;
};

export type LidoKeysData = {
  data: LidoKey[];
  meta: {
    elBlockSnapshot: {
      blockNumber: number;
      blockHash: string;
      timestamp: number;
    };
  };
};
