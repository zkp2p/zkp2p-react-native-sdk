import { Platform } from 'react-native';
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

    // Processor names to deployed addresses
    venmo: '0x9a733B55a875D0DB4915c6B36350b24F8AB99dF5',
    revolut: '0xAA5A1B62B01781E789C900d616300717CD9A41aB',
    cashapp: '0x76D33A33068D86016B806dF02376dDBb23Dd3703',
    wise: '0xFF0149799631D7A5bdE2e7eA9b306c42b3d9a9ca',
    mercadopago: '0xf2AC5be14F32Cbe6A613CFF8931d95460D6c33A3',

    // offchain services
    gatingService: '0x396D31055Db28C0C6f36e8b36f18FE7227248a97',
    zkp2pWitnessSigner: '0x0636c417755E3ae25C6c166D181c0607F4C572A3',
  },
  31337: {
    // external contracts
    usdc: '0x5FbDB2315678afecb367f032d93F642f64180aa3',

    // escrow + verifiers
    escrow: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    venmo: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    revolut: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
    cashapp: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
    wise: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
    mercadopago: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
    zelle: '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',

    // offchain services
    gatingService: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Hardhat 0
    zkp2pWitnessSigner: '0x0636c417755E3ae25C6c166D181c0607F4C572A3',
  },
};

export const chainIds: { [network: string]: string } = {
  hardhat: '31337',
  sepolia: '11155111',
  base: '8453',
};

export const DEFAULT_BASE_API_URL = 'https://api.zkp2p.xyz/v1';
export const DEFAULT_WITNESS_URL = 'https://witness-proxy.zkp2p.xyz';

export const DEFAULT_PROVIDERS_BASE_URL =
  'https://raw.githubusercontent.com/zkp2p/providers/refs/heads/main/';

export const DEFAULT_USER_AGENT = Platform.select({
  ios: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
  default:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
});
