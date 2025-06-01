import 'fast-text-encoding';
import { useZkp2p } from './hooks/useZkp2p';
import { Zkp2pProvider, Zkp2pContext } from './providers';
import { DEPLOYED_ADDRESSES } from './utils/constants';
import { currencyInfo } from './utils/currency';

export {
  useZkp2p,
  Zkp2pProvider,
  Zkp2pContext,
  DEPLOYED_ADDRESSES,
  currencyInfo,
};

export type {
  ExtractedItemsList,
  NetworkEvent,
  ProviderSettings,
  SignalIntentParams,
  FulfillIntentParams,
  SignalIntentResponse,
  AuthWVOverrides,
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
  ProofData,
  FlowState,
} from './types';
