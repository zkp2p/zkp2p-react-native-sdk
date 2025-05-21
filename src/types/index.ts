import type { WalletClient, Hash } from 'viem';
import type { Range } from './contract';
import type { InterceptWebView } from '@zkp2p/react-native-webview-intercept';
import type { CurrencyType } from '../utils/currency';

export interface AuthWVOverrides
  extends Partial<React.ComponentProps<typeof InterceptWebView>> {}

export type {
  DepositView,
  IntentView,
  Range,
  DepositVerifierData,
  Currency,
} from './contract';

export type Address = `0x${string}`;

export interface Zkp2pClientOptions {
  walletClient: WalletClient;
  apiKey: string;
  chainId: number;
  baseApiUrl?: string;
  witnessUrl?: string;
  rpcUrl?: string;
  logLevel?: 'silent' | 'error' | 'info' | 'debug';
  pollingInterval?: number; // ms
}

export type TxCallbackParams = {
  hash: Hash;
  data?: any;
};

export type ActionCallback = (params: TxCallbackParams) => void;

export type FulfillIntentParams = {
  paymentProof: Hash;
  intentHash: Hash;
  onSuccess?: ActionCallback;
  onError?: (error: Error) => void;
  onMined?: ActionCallback;
};

export type CancelIntentParams = {
  intentHash: Hash;
  onSuccess?: ActionCallback;
  onError?: (error: Error) => void;
  onMined?: ActionCallback;
};

export type ReleaseFundsToPayerParams = {
  intentHash: Hash;
  onSuccess?: ActionCallback;
  onError?: (error: Error) => void;
  onMined?: ActionCallback;
};

export type WithdrawDepositParams = {
  depositId: string;
  onSuccess?: ActionCallback;
  onError?: (error: Error) => void;
  onMined?: ActionCallback;
};

export type SignalIntentParams = {
  processorName: string;
  depositId: string;
  tokenAmount: string;
  payeeDetails: string;
  toAddress: string;
  currency: CurrencyType;
  onSuccess?: ActionCallback;
  onError?: (error: Error) => void;
  onMined?: ActionCallback;
};

export type CreateDepositParams = {
  token: Address;
  amount: bigint;
  intentAmountRange: Range;
  conversionRates: { currency: CurrencyType; conversionRate: string }[];
  processorNames: string[];
  depositData: {
    [key: string]: string;
  }[];
  onSuccess?: ActionCallback;
  onError?: (error: Error) => void;
  onMined?: ActionCallback;
};

export type IntentSignalRequest = {
  processorName: string;
  depositId: string;
  tokenAmount: string;
  payeeDetails: string;
  toAddress: string;
  fiatCurrencyCode: string;
  chainId: string;
};

export type SignalIntentResponse = {
  success: boolean;
  message: string;
  responseObject: {
    depositData: Record<string, any>;
    signedIntent: string;
    intentData: {
      depositId: string;
      tokenAmount: string;
      recipientAddress: string;
      verifierAddress: string;
      currencyCodeHash: string;
      gatingServiceSignature: string;
    };
  };
  statusCode: number;
};

export type PostDepositDetailsRequest = {
  depositData: {
    [key: string]: string;
  };
  processorName: string;
};

export type PostDepositDetailsResponse = {
  success: boolean;
  message: string;
  responseObject: {
    id: number;
    processorName: string;
    depositData: {
      [key: string]: string;
    };
    hashedOnchainId: string;
    createdAt: string;
  };
  statusCode: number;
};

export type QuoteMaxTokenForFiatRequest = {
  paymentPlatforms: string[];
  fiatCurrency: string;
  user: string;
  recipient: string;
  destinationChainId: number;
  destinationToken: string;
  referrer?: string;
  useMultihop?: boolean;
  exactFiatAmount: string;
};

export type FiatResponse = {
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  countryCode: string;
};

export type TokenResponse = {
  token: string;
  decimals: number;
  name: string;
  symbol: string;
  chainId: number;
};

export type QuoteIntentResponse = {
  depositId: string;
  processorName: string;
  amount: string;
  toAddress: string;
  payeeDetails: string;
  processorIntentData: any;
  fiatCurrencyCode: string;
  chainId: string;
};

export type QuoteSingleResponse = {
  fiatAmount: string;
  fiatAmountFormatted: string;
  tokenAmount: string;
  tokenAmountFormatted: string;
  paymentMethod: string;
  payeeAddress: string;
  conversionRate: string;
  intent: QuoteIntentResponse;
};

export type QuoteFeesResponse = {
  zkp2pFee: string;
  zkp2pFeeFormatted: string;
  swapFee: string;
  swapFeeFormatted: string;
};

export type QuoteResponse = {
  message: string;
  success: boolean;
  responseObject: {
    fiat: FiatResponse;
    token: TokenResponse;
    quotes: QuoteSingleResponse[];
    fees: QuoteFeesResponse;
  };
  statusCode: number;
};

export type GetPayeeDetailsRequest = {
  hashedOnchainId: string;
  platform: string;
};

export type GetPayeeDetailsResponse = {
  success: boolean;
  message: string;
  responseObject: {
    id: number;
    processorName: string;
    depositData: {
      [key: string]: string;
    };
    hashedOnchainId: string;
    createdAt: string;
  };
  statusCode: number;
};

export const DepositStatus = {
  ACTIVE: 'ACTIVE',
  WITHDRAWN: 'WITHDRAWN',
  CLOSED: 'CLOSED',
} as const;

export type DepositStatusType =
  (typeof DepositStatus)[keyof typeof DepositStatus];

export type Deposit = {
  id: string;
  owner: string;
  token: string;
  amount: string;
  status: DepositStatusType;
  createdAt?: Date;
  updatedAt?: Date;
  verifiers: Array<{
    id: string;
    verifier: string;
    createdAt?: Date;
    updatedAt?: Date;
    currencies: Array<{
      id: string;
      code: string;
      conversionRate: string;
      createdAt?: Date;
      updatedAt?: Date;
    }>;
  }>;
};

export type GetOwnerDepositsRequest = {
  ownerAddress: string;
};

export type GetOwnerDepositsResponse = {
  success: boolean;
  message: string;
  responseObject: Deposit[];
  statusCode: number;
};

export const IntentStatus = {
  SIGNALED: 'SIGNALED',
  FULFILLED: 'FULFILLED',
  PRUNED: 'PRUNED',
} as const;

export type IntentStatusType = (typeof IntentStatus)[keyof typeof IntentStatus];

export type Intent = {
  id: number;
  intentHash: string;
  status: IntentStatusType;
  depositId: string;
  verifier: string;
  owner: string;
  toAddress: string;
  amount: string;
  fiatCurrency: string;
  conversionRate: string;
  sustainabilityFee: string | null;
  verifierFee: string | null;
  signalTxHash: string;
  signalTimestamp: Date;
  fulfillTxHash: string | null;
  fulfillTimestamp: Date | null;
  pruneTxHash: string | null;
  prunedTimestamp: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GetDepositOrdersRequest = {
  depositId: string;
};

export type GetDepositOrdersResponse = {
  success: boolean;
  message: string;
  responseObject: Intent[];
  statusCode: number;
};

export type GetDepositRequest = {
  depositId: string;
};

export type GetDepositResponse = {
  success: boolean;
  message: string;
  responseObject: {
    id: string;
    owner: string;
    token: string;
    amount: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    verifiers: Array<{
      id: string;
      verifier: string;
      createdAt: string;
      updatedAt: string;
      currencies: Array<{
        id: string;
        code: string;
        conversionRate: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>;
  };
  statusCode: number;
};

export type GetOwnerIntentsRequest = {
  ownerAddress: string;
};

export type GetOwnerIntentsResponse = {
  success: boolean;
  message: string;
  responseObject: Intent[];
  statusCode: number;
};

export type ExtractedItemsList = {
  [k: string]: any; // dynamic columns
  hidden: boolean;
  originalIndex: number;
};

export interface Selector {
  type: string;
  value: string;
}

export interface ResponseMatch extends Selector {
  hash?: boolean;
}

export interface ResponseRedaction {
  jsonPath?: string;
  xPath?: string;
  regex?: string;
}

export interface TransactionsExtraction {
  transactionJsonPathListSelector: string;
  transactionJsonPathSelectors: Record<string, string>;
}

export interface ProviderMetadata {
  platform: string;
  urlRegex: string;
  method: string;
  fallbackUrlRegex: string;
  fallbackMethod: string;
  preprocessRegex: string;
  shouldReplayRequestInPage?: boolean;
  transactionsExtraction: TransactionsExtraction;
  proofMetadataSelectors: Selector[];
}

export interface ProviderSettings {
  actionType: string;
  authLink: string;
  url: string;
  method: string;
  skipRequestHeaders: string[];
  body: string;
  countryCode?: string;
  metadata: ProviderMetadata;
  paramNames: string[];
  paramSelectors: Selector[];
  secretHeaders: string[];
  responseMatches: ResponseMatch[];
  responseRedactions: ResponseRedaction[];
}

export interface NetworkEvent {
  type: 'network';
  api: 'fetch' | 'xhr' | 'html';
  request: {
    url: string;
    method?: string;
    headers: Record<string, string>;
    body?: string | null;
    cookie: string | null;
  };
  response: {
    url: string;
    status: number;
    headers: Record<string, string>;
    body: string | null;
  };
}

export type RPCResponse = {
  module: 'attestor-core';
  id: string;
  type: string;
  response?: any;
  step?: any;
  error?: { data: { message: string; stack?: string } };
};

export type PendingEntry = {
  resolve: (r: RPCResponse) => void;
  reject: (e: Error) => void;
  timeout: NodeJS.Timeout;
  onStep?: (step: RPCResponse) => void;
};

// Export on-chain view types
export type {
  EscrowRange,
  EscrowDepositView,
  EscrowIntentView,
} from './escrowViews';
