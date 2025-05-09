import type { Address } from 'viem';

type Contracts = {
  [chainId: number]: {
    [contract: string]: Address;
  };
};

export const DEPLOYED_ADDRESSES: Contracts = {
  8453: {
    // external contracts
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',

    // escrow + verifiers
    escrow: '0xCA38607D85E8F6294Dc10728669605E6664C2D70',
    venmoReclaimVerifier: '0x9a733B55a875D0DB4915c6B36350b24F8AB99dF5',
    revolutReclaimVerifier: '0xAA5A1B62B01781E789C900d616300717CD9A41aB',
    cashappReclaimVerifier: '0x76D33A33068D86016B806dF02376dDBb23Dd3703',
    wiseReclaimVerifier: '0xFF0149799631D7A5bdE2e7eA9b306c42b3d9a9ca',
    mercadopagoReclaimVerifier: '0xf2AC5be14F32Cbe6A613CFF8931d95460D6c33A3',

    // offchain services
    gatingService: '0x396D31055Db28C0C6f36e8b36f18FE7227248a97',
    zkp2pWitnessSigner: '0x0636c417755E3ae25C6c166D181c0607F4C572A3',
  },
  11155111: {
    // external contracts
    usdc: '0x7a1C5Ee7461ab2790Aa9A93017fFCf789B785D12',

    // escrow + verifiers
    escrow: '0xFF0149799631D7A5bdE2e7eA9b306c42b3d9a9ca',
    venmoReclaimVerifier: '0x3Fa6C4135696fBD99F7D55B552B860f5df770710',
    revolutReclaimVerifier: '0x79820f039942501F412910C083aDA6dCc419B67c',
    cashappReclaimVerifier: '0x3997dd7B691E11D45E8898601F5bc7B016b0d38B',
    wiseReclaimVerifier: '0x7cF01c990F5E93Eb4eaaC2146dFeC525a9C87878',
    mercadopagoReclaimVerifier: '0xa70E7B29C372D71E0EE8E0a5c5721F3724e45CF3',

    // offchain services
    gatingService: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Hardhat 0
    zkp2pWitnessSigner: '0x0636c417755E3ae25C6c166D181c0607F4C572A3',
  },
};

export const blockExplorerUrls: { [network: string]: string } = {
  hardhat: 'https://etherscan.io',
  sepolia: 'https://sepolia.etherscan.io/',
  base: 'https://basescan.org',
  solana: 'https://solscan.io',
  eth: 'https://etherscan.io',
  polygon: 'https://polygonscan.com',
  sonic: 'https://sonicscan.org',
  tron: 'https://tronscan.org',
  bnb: 'https://bscscan.com',
};

export const chainIds: { [network: string]: string } = {
  hardhat: '31337',
  sepolia: '11155111',
  base: '8453',
};

export const DEFAULT_BASE_API_URL = 'https://api.zkp2p.xyz/v1';
// export const DEFAULT_WITNESS_URL = 'https://witness-proxy.zkp2p.xyz';
export const DEFAULT_WITNESS_URL = 'http://localhost:8001';
