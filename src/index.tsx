import 'fast-text-encoding';

// Core hooks and providers
export { useZkp2p } from './hooks/useZkp2p';
export { Zkp2pProvider, Zkp2pContext } from './providers';

// Client
export { Zkp2pClient } from './client';

// Constants and utilities
export { DEPLOYED_ADDRESSES } from './utils/constants';
export { currencyInfo } from './utils/currency';

// Types
export type {
  // Provider types
  ExtractedMetadataList,
  NetworkEvent,
  ProviderSettings,
  ProofData,
  FlowState,
  InitiateOptions,
  AutoGenerateProofOptions,

  // API types
  SignalIntentParams,
  FulfillIntentParams,
  SignalIntentResponse,
  WithdrawDepositParams,
  CancelIntentParams,
  ReleaseFundsToPayerParams,
  CreateDepositParams,
  PostDepositDetailsRequest,
  DepositVerifierData,
  Currency,
  IntentSignalRequest,
  QuoteMaxTokenForFiatRequest,
  QuoteResponse,
  GetPayeeDetailsRequest,
  GetPayeeDetailsResponse,

  // Other types
  AuthWVOverrides,
} from './types';

// Export bridge types
export type { GnarkBridge, GnarkProofResult } from './bridges';
