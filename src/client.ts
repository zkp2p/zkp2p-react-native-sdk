import type { Address, Hash, PublicClient, WalletClient, Chain } from 'viem';
import { createPublicClient, http } from 'viem';
import { base, hardhat } from 'viem/chains';
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
  PostDepositDetailsRequest,
  WithdrawDepositParams,
  CancelIntentParams,
  ReleaseFundsToPayerParams,
  EscrowDepositView,
  EscrowIntentView,
} from './types';
import { fulfillIntent } from './actions/fulfillIntent';
import { signalIntent } from './actions/signalIntent';
import { createDeposit } from './actions/createDeposit';
import { apiGetQuote, apiGetPayeeDetails } from './adapters/api';
import { withdrawDeposit } from './actions/withdrawDeposit';
import { cancelIntent } from './actions/cancelIntent';
import { releaseFundsToPayer } from './actions/releaseFundsToPayer';
import {
  parseEscrowDepositView,
  parseEscrowIntentView,
} from './utils/escrowViewParsers';
import { ESCROW_ABI } from './utils/contracts';

export class Zkp2pClient {
  readonly walletClient: WalletClient;
  readonly apiKey: string;
  readonly chainId: number;
  readonly baseApiUrl: string;
  readonly witnessUrl: string;
  readonly addresses: { escrow: Address };
  readonly publicClient: PublicClient;

  /**
   * Creates a new Zkp2pClient instance.
   *
   * @param opts configuration options including wallet client and API key
   */
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
    } else if (this.chainId === hardhat.id) {
      selectedChainObject = hardhat;
    } else {
      // If the chainId doesn't match a pre-configured one (like Base),
      // we cannot automatically provide a default RPC URL.
      // Throw an error to indicate this configuration issue.
      // The Zkp2pClientOptions could be extended in the future to allow passing a custom rpcUrl.
      throw new Error(
        `Zkp2pClient: The public client for chain ID ${this.chainId} is not configured with a default RPC URL. ` +
          `Currently, only Base (ID: ${base.id}) and Hardhat (ID: ${hardhat.id}) are auto-configured. ` +
          `Please use a supported chain or supply the rpcUrl option.`
      );
    }

    this.publicClient = createPublicClient({
      chain: selectedChainObject,
      transport: http(opts.rpcUrl), // allow overriding the default RPC URL
    }) as PublicClient;
  }

  /**
   * Calls the escrow contract to fulfill a previously signalled intent.
   */
  async fulfillIntent(params: FulfillIntentParams): Promise<Hash> {
    return fulfillIntent(
      this.walletClient,
      this.publicClient,
      this.addresses.escrow,
      params
    );
  }

  /**
   * Signals an intent to off-chain services and emits the corresponding on-chain event.
   */
  async signalIntent(
    params: SignalIntentParams
  ): Promise<SignalIntentResponse & { txHash?: Hash }> {
    return signalIntent(
      this.walletClient,
      this.publicClient,
      this.addresses.escrow,
      this.chainId,
      params,
      this.apiKey,
      this.baseApiUrl
    );
  }

  /**
   * Creates a deposit on-chain and stores deposit details via the API.
   */
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

  /**
   * Withdraws a deposit from the escrow contract.
   */
  async withdrawDeposit(params: WithdrawDepositParams): Promise<Hash> {
    return withdrawDeposit(
      this.walletClient,
      this.publicClient,
      this.addresses.escrow,
      params
    );
  }

  /**
   * Cancels an intent.
   */
  async cancelIntent(params: CancelIntentParams): Promise<Hash> {
    return cancelIntent(
      this.walletClient,
      this.publicClient,
      this.addresses.escrow,
      params
    );
  }

  /**
   * Releases funds to the payer.
   */
  async releaseFundsToPayer(params: ReleaseFundsToPayerParams): Promise<Hash> {
    return releaseFundsToPayer(
      this.walletClient,
      this.publicClient,
      this.addresses.escrow,
      params
    );
  }

  /**
   * Retrieve a token quote for a given fiat amount.
   */
  async getQuote(params: QuoteMaxTokenForFiatRequest): Promise<QuoteResponse> {
    return apiGetQuote(params, this.baseApiUrl);
  }

  /** Fetch details about a payee via the API. */
  async getPayeeDetails(
    params: GetPayeeDetailsRequest
  ): Promise<GetPayeeDetailsResponse> {
    return apiGetPayeeDetails(params, this.apiKey, this.baseApiUrl);
  }

  /**
   * Fetches and parses deposit views directly from the escrow contract for a given account.
   */
  async getAccountDeposits(
    ownerAddress: Address
  ): Promise<EscrowDepositView[]> {
    if (!this.publicClient) {
      throw new Error('Public client is not initialized.');
    }
    try {
      const rawDepositViews = await this.publicClient.readContract({
        address: this.addresses.escrow,
        abi: ESCROW_ABI,
        functionName: 'getAccountDeposits',
        args: [ownerAddress],
      });

      if (!rawDepositViews) {
        return [];
      }
      return rawDepositViews.map(parseEscrowDepositView);
    } catch (error) {
      console.error('Error fetching account deposit views:', error);
      throw error;
    }
  }

  /**
   * Fetches and parses intent views directly from the escrow contract for given intent hashes.
   */
  async getAccountIntent(
    ownerAddress: Address
  ): Promise<EscrowIntentView | null> {
    if (!this.publicClient) {
      throw new Error('Public client is not initialized.');
    }
    try {
      const rawIntentViews = await this.publicClient.readContract({
        address: this.addresses.escrow,
        abi: ESCROW_ABI,
        functionName: 'getAccountIntent',
        args: [ownerAddress],
      });

      if (
        !rawIntentViews ||
        rawIntentViews.intentHash ===
          '0x0000000000000000000000000000000000000000000000000000000000000000'
      ) {
        return null;
      }
      return parseEscrowIntentView(rawIntentViews);
    } catch (error) {
      console.error('Error fetching intent views:', error);
      throw error; // Re-throw or handle more gracefully
    }
  }
}
