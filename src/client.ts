import type { Address, Hash, PublicClient, WalletClient, Chain } from 'viem';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
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
  readonly addresses: { escrow: Address };
  readonly publicClient: PublicClient;

  constructor(opts: Zkp2pClientOptions) {
    this.walletClient = opts.walletClient;
    this.apiKey = opts.apiKey;
    this.chainId = opts.chainId;
    this.baseApiUrl = opts.baseApiUrl || DEFAULT_BASE_API_URL;
    this.witnessUrl = opts.witnessUrl || DEFAULT_WITNESS_URL;

    const contractAddresses = DEPLOYED_ADDRESSES[this.chainId];
    if (!contractAddresses?.escrow)
      throw new Error(
        `Unsupported chainId ${opts.chainId} for ZKP2P contracts.`
      );
    this.addresses = { escrow: contractAddresses.escrow };

    let selectedChainObject: Chain;
    if (this.chainId === base.id) {
      selectedChainObject = base;
    }
    // TODO: Add explicit support for other chains here if needed, e.g.:
    // else if (this.chainId === mainnet.id) { selectedChainObject = mainnet; }
    else {
      // If the chainId doesn't match a pre-configured one (like Base),
      // we cannot automatically provide a default RPC URL.
      // Throw an error to indicate this configuration issue.
      // The Zkp2pClientOptions could be extended in the future to allow passing a custom rpcUrl.
      throw new Error(
        `Zkp2pClient: The public client for chain ID ${this.chainId} is not configured with a default RPC URL. ` +
          `Currently, only Base (ID: ${base.id}) is auto-configured. ` +
          `Please use a supported chain or update client options to allow custom RPC URLs for the public client.`
      );
    }

    this.publicClient = createPublicClient({
      chain: selectedChainObject,
      transport: http(), // This will use the default RPC URL from selectedChainObject
    }) as PublicClient;
  }

  async fulfillIntent(params: FulfillIntentParams): Promise<Hash> {
    return fulfillIntent(
      this.walletClient,
      this.publicClient,
      this.addresses.escrow,
      params
    );
  }

  async signalIntent(
    params: SignalIntentParams
  ): Promise<SignalIntentResponse & { txHash?: Hash }> {
    return signalIntent(
      this.walletClient,
      this.publicClient,
      this.addresses.escrow,
      params,
      this.apiKey,
      this.baseApiUrl
    );
  }

  async createDeposit(
    params: CreateDepositParams
  ): Promise<{ depositDetails: PostDepositDetailsRequest[]; hash: Hash }> {
    return createDeposit(
      this.walletClient,
      this.publicClient,
      this.addresses.escrow,
      this.chainId,
      params,
      this.apiKey,
      this.baseApiUrl
    );
  }

  async getQuote(params: QuoteMaxTokenForFiatRequest): Promise<QuoteResponse> {
    return apiGetQuote(params, this.baseApiUrl);
  }

  async getPayeeDetails(
    params: GetPayeeDetailsRequest
  ): Promise<GetPayeeDetailsResponse> {
    return apiGetPayeeDetails(params, this.apiKey, this.baseApiUrl);
  }

  async getOwnerDeposits(
    params: GetOwnerDepositsRequest
  ): Promise<GetOwnerDepositsResponse> {
    return apiGetOwnerDeposits(params, this.apiKey, this.baseApiUrl);
  }

  async getDepositOrders(
    params: GetDepositOrdersRequest
  ): Promise<GetDepositOrdersResponse> {
    return apiGetDepositOrders(params, this.apiKey, this.baseApiUrl);
  }

  async getDeposit(params: GetDepositRequest): Promise<GetDepositResponse> {
    return apiGetDeposit(params, this.apiKey, this.baseApiUrl);
  }
}
