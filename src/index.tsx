import 'fast-text-encoding';

export { useZkp2p } from './hooks/useZkp2p';
export { Zkp2pProvider, Zkp2pContext } from './providers';
export { Zkp2pClient } from './client';
export { DEPLOYED_ADDRESSES } from './utils/constants';
export { currencyInfo } from './utils/currency';

export type {
  ExtractedMetadataList,
  NetworkEvent,
  ProviderSettings,
  ProofData,
  FlowState,
  InitiateOptions,
  AutoGenerateProofOptions,
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
  AuthWVOverrides,
} from './types';

export type { GnarkBridge, GnarkProofResult } from './bridges';
