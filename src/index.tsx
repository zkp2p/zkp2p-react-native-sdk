import 'fast-text-encoding';
import { useZkp2p } from './hooks/useZkp2p';
import { Zkp2pProvider, Zkp2pContext } from './providers';

export { useZkp2p, Zkp2pProvider, Zkp2pContext };

export type {
  ExtractedItemsList,
  NetworkEvent,
  ProviderSettings,
  SignalIntentParams,
  FulfillIntentParams,
  SignalIntentResponse,
  AuthWVOverrides,
  IntentStatusType,
  Intent,
  Deposit,
  WithdrawDepositParams,
  CancelIntentParams,
  ReleaseFundsToPayerParams,
  CreateDepositParams,
  PostDepositDetailsRequest,
  DepositVerifierData,
  Currency,
  GetOwnerDepositsRequest,
  GetOwnerDepositsResponse,
  GetDepositOrdersRequest,
  GetDepositOrdersResponse,
  GetDepositRequest,
  GetDepositResponse,
  GetOwnerIntentsRequest,
  GetOwnerIntentsResponse,
  IntentSignalRequest,
  QuoteMaxTokenForFiatRequest,
  QuoteResponse,
  GetPayeeDetailsRequest,
  GetPayeeDetailsResponse,
} from './types';
