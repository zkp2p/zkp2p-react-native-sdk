import type { Address, Hash, PublicClient, WalletClient, Chain } from 'viem';
import { createPublicClient, http } from 'viem';
import { base, hardhat, scroll } from 'viem/chains';
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
  readonly addresses: {
    escrow: Address;
    usdc: Address;
    venmo: Address;
    revolut: Address;
    cashapp: Address;
    wise: Address;
    mercadopago: Address;
    zelle: Address;
    gatingService: Address;
    zkp2pWitnessSigner: Address;
  };
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
    if (!contractAddresses)
      throw new Error(
        `Unsupported chainId ${opts.chainId} for ZKP2P contracts.`
      );

    this.addresses = {
      escrow: contractAddresses.escrow,
      usdc: contractAddresses.usdc,
      venmo: contractAddresses.venmo,
      revolut: contractAddresses.revolut,
      cashapp: contractAddresses.cashapp,
      wise: contractAddresses.wise,
      mercadopago: contractAddresses.mercadopago,
      zelle: contractAddresses.zelle,
      gatingService: contractAddresses.gatingService,
      zkp2pWitnessSigner: contractAddresses.zkp2pWitnessSigner,
    };

    // Create a mapping of supported chains
    const supportedChains: Record<number, Chain> = {
      [base.id]: base,
      [hardhat.id]: hardhat,
      [scroll.id]: scroll,
    };

    // Check if the chain is supported
    const selectedChainObject = supportedChains[this.chainId];

    if (!selectedChainObject) {
      throw new Error(
        `Zkp2pClient: Chain ID ${this.chainId} is not supported. ` +
          `Supported chains are: Base (${base.id}), Hardhat (${hardhat.id}), and Scroll (${scroll.id}).`
      );
    }

    // Use the pre-configured chain, with optional RPC URL override
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
      console.error('[zkp2p] Error fetching account deposits:', error);
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
      console.error('[zkp2p] Error fetching account intent:', error);
      throw error;
    }
  }

  /**
   * Get the USDC contract address for the current chain
   */
  getUsdcAddress(): Address {
    return this.addresses.usdc;
  }

  /**
   * Get all deployed addresses for the current chain
   */
  getDeployedAddresses(): typeof this.addresses {
    return this.addresses;
  }
}
