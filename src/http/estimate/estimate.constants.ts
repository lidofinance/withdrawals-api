import { CHAINS } from '@lido-nestjs/constants';

export const ESTIMATE_ACCOUNT = '0x87c0e047F4e4D3e289A56a36570D4CB957A37Ef1';

// fallback gas limits per 1 withdraw request
export const WITHDRAWAL_QUEUE_REQUEST_STETH_PERMIT_GAS_LIMIT_DEFAULT = 255350;
export const WITHDRAWAL_QUEUE_REQUEST_WSTETH_PERMIT_GAS_LIMIT_DEFAULT = 312626;
export const WITHDRAWAL_QUEUE_CLAIM_GAS_LIMIT_DEFAULT = 89818;

type PermitData = {
  r: string;
  s: string;
  v: number;
  value: string;
  deadline: string;
};

export const ESTIMATE_ACCOUNT_PERMITS: {
  [key in CHAINS]?: { steth_permit: PermitData; wsteth_permit: PermitData };
} = {
  [CHAINS.Zhejiang]: {
    steth_permit: {
      r: '0xf1baeb202095cd7f5df5aa3c915a9482d066d8cc62661089ca57fb6d2e6e283d',
      s: '0x7e9344e57b670352c456f587295ec7ef6a7ae9093df07b1899ffa7f675262ba4',
      v: 28,
      value: '1000000000000000',
      deadline: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
    wsteth_permit: {
      r: '0x1a53ccbabf77df1b31f28a8153e3a766c761ef6cba2998df1c96d8bddbbae8c9',
      s: '0x62d2e777d91cfa9ff42d3c3c0a5d52384f7dd5c3596074e25c5682134e9e4105',
      v: 28,
      value: '1000000000000000',
      deadline: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
  },
  [CHAINS.Goerli]: {
    steth_permit: {
      r: '0x8bb9510ea8b9770dd65f370c61462c1377882bea2e3781a048d64f4cec9c1f61',
      s: '0x6e9f2a5368b4ca200460d44d1fe7bd5445736200c566b39a118a3d34bacd9cca',
      v: 27,
      value: '1000000000000000',
      deadline: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
    wsteth_permit: {
      r: '0x545bcac878052e1ee7b66f3116c33bfb39ad2e050db4ab0db1ebd6155133f495',
      s: '0x4a66466cad749f1d5d4521d2b407e3da335115adf0be5a779c100721e792758f',
      v: 28,
      value: '1000000000000000',
      deadline: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
  },
  [CHAINS.Mainnet]: {
    steth_permit: {
      r: '0xc0ccc03b150e93ad36c5a47fa2ee960527ec32e056e4fa16bb15939af8d65fb7',
      s: '0x37c580eef3a664a321b7c8d14ee583fa3800735e738eff8c589996c974c90f9a',
      v: 28,
      value: '1000000000000000',
      deadline: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
    wsteth_permit: {
      r: '0x9b2284498dd54606dc6fd86b14101ffa62d2bb1abb1058c0fec02cdeb29d3c93',
      s: '0x4215b88db450e21e2418ff916c35e06ac6e75c493fa95b938e7b009efcc300f1',
      v: 27,
      value: '1000000000000000',
      deadline: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
  },
} as const;
