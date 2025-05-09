import type { Address, Hash, PublicClient, WalletClient, Chain } from 'viem';
import { createPublicClient, http } from 'viem';
import {
  DEPLOYED_ADDRESSES,
  DEFAULT_BASE_API_URL,
  DEFAULT_WITNESS_URL,
} from './utils/constants';
import type {
  Zkp2pClientOptions,
  FulfillIntentParams,
  SignalIntentParams,
  CreateDepositParams,
  SignalIntentResponse,
  QuoteMaxTokenForFiatRequest,
  QuoteResponse,
  GetPayeeDetailsRequest,
  GetPayeeDetailsResponse,
  GetOwnerDepositsRequest,
  GetOwnerDepositsResponse,
  GetDepositOrdersRequest,
  GetDepositOrdersResponse,
  GetDepositRequest,
  GetDepositResponse,
  PostDepositDetailsRequest,
} from './types';
import { fulfillIntent } from './actions/fulfillIntent';
import { signalIntent } from './actions/signalIntent';
import { createDeposit } from './actions/createDeposit';
import {
  apiGetQuote,
  apiGetPayeeDetails,
  apiGetOwnerDeposits,
  apiGetDepositOrders,
  apiGetDeposit,
} from './adapters/api';

export class Zkp2pClient {
  readonly walletClient: WalletClient;
  readonly apiKey: string;
  readonly chainId: number;
  readonly baseApiUrl: string;
  readonly witnessUrl: string;
  readonly addresses: { ESCROW: Address };
  readonly publicClient: PublicClient;

  constructor(opts: Zkp2pClientOptions) {
    this.walletClient = opts.walletClient;
    this.apiKey = opts.apiKey;
    this.chainId = opts.chainId;
    this.baseApiUrl = opts.baseApiUrl || DEFAULT_BASE_API_URL;
    this.witnessUrl = opts.witnessUrl || DEFAULT_WITNESS_URL;

    const addresses = DEPLOYED_ADDRESSES[this.chainId];
    if (!addresses?.ESCROW)
      throw new Error(`Unsupported chainId ${opts.chainId}`);
    this.addresses = { ESCROW: addresses.ESCROW };

    this.publicClient = createPublicClient({
      chain: {
        id: this.chainId,
        name: 'Optimism',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [''] } },
      } as Chain,
      transport: http(),
    });
  }

  async fulfillIntent(params: FulfillIntentParams): Promise<Hash> {
    return fulfillIntent(
      this.walletClient,
      this.publicClient,
      this.addresses.ESCROW,
      params
    );
  }

  async signalIntent(
    params: SignalIntentParams
  ): Promise<SignalIntentResponse & { txHash?: Hash }> {
    return signalIntent(
      this.walletClient,
      this.publicClient,
      this.addresses.ESCROW,
      params
    );
  }

  async createDeposit(
    params: CreateDepositParams
  ): Promise<{ depositDetails: PostDepositDetailsRequest[]; hash: Hash }> {
    return createDeposit(
      this.walletClient,
      this.publicClient,
      this.addresses.ESCROW,
      this.chainId,
      params
    );
  }

  async getQuote(params: QuoteMaxTokenForFiatRequest): Promise<QuoteResponse> {
    return apiGetQuote(params);
  }

  async getPayeeDetails(
    params: GetPayeeDetailsRequest
  ): Promise<GetPayeeDetailsResponse> {
    return apiGetPayeeDetails(params);
  }

  async getOwnerDeposits(
    params: GetOwnerDepositsRequest
  ): Promise<GetOwnerDepositsResponse> {
    return apiGetOwnerDeposits(params);
  }

  async getDepositOrders(
    params: GetDepositOrdersRequest
  ): Promise<GetDepositOrdersResponse> {
    return apiGetDepositOrders(params);
  }

  async getDeposit(params: GetDepositRequest): Promise<GetDepositResponse> {
    return apiGetDeposit(params);
  }
}

let _client: Zkp2pClient | undefined;
export const createClient = (opts: {
  walletClient: WalletClient;
  apiKey: string;
  chainId: number;
  baseApiUrl?: string;
  witnessUrl?: string;
}) => (_client = new Zkp2pClient(opts));
export const getClient = () => {
  if (!_client) throw new Error('ZKP2P client not initialised');
  return _client;
};
