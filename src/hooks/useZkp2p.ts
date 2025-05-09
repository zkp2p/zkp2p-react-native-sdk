import { useCallback, useState, useEffect } from 'react';
import { useAuthentication } from './useAuthentication';
import { useProofGeneration } from './useProofGeneration';
import { useTransactionExtraction } from './useTransactionExtraction';
import { useInterceptedPayload } from './useInterceptedPayload';
import { getClient } from '../client';
import type {
  ExtractedTransaction,
  NetworkEvent,
  ProviderSettings,
  SignalIntentParams,
  FulfillIntentParams,
  SignalIntentResponse,
} from '../types';

interface UseZkp2pReturn {
  // Client state
  isClientInitialized: boolean;

  // Intent flow
  signalIntent: (
    params: SignalIntentParams
  ) => Promise<SignalIntentResponse & { txHash?: string }>;
  fulfillIntent: (params: FulfillIntentParams) => Promise<string>;

  // Authentication flow
  provider: ProviderSettings | null;
  startAuthentication: (
    platform: string,
    actionType: string
  ) => Promise<ProviderSettings>;
  handleError: (error: string) => void;
  handleSuccess: () => void;
  isAuthenticating: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isCheckingStoredAuth: boolean;
  checkStoredAuth: () => Promise<boolean>;

  // Transaction flow
  transactions: ExtractedTransaction[];
  selectedTransaction: ExtractedTransaction | null;
  handleTransactionSelect: (transaction: ExtractedTransaction) => void;

  // Proof generation flow
  isGeneratingProof: boolean;
  claimData: any | null;
  generateProof: (
    provider: ProviderSettings,
    transaction: ExtractedTransaction,
    interceptedPayload: NetworkEvent,
    intentHash: string
  ) => Promise<any>;
  isWebViewReady: boolean;
  handleRPCMessage: (event: any) => void;
  handleWebViewLoad: () => void;
  handleWebViewError: (error: any) => void;

  // WebView refs
  rpcWebViewRef: any;

  // Intercepted data
  interceptedPayload: NetworkEvent | null;
}

export const useZkp2p = (): UseZkp2pReturn => {
  // Local state
  const [isClientInitialized, setIsClientInitialized] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<ExtractedTransaction | null>(null);
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize hooks
  const {
    provider,
    startAuthentication,
    handleError,
    handleSuccess,
    isAuthenticating,
    error,
  } = useAuthentication();

  const { extractTransactionsData } = useTransactionExtraction();

  const {
    interceptedPayload,
    handleIntercept,
    clearInterceptedPayload,
    isCheckingStoredAuth,
    checkStoredAuth,
  } = useInterceptedPayload(provider);

  const {
    isGeneratingProof,
    claimData,
    generateProof: generateProofBase,
    rpcWebViewRef,
    isWebViewReady,
    handleRPCMessage,
    handleWebViewLoad,
    handleWebViewError,
  } = useProofGeneration();

  // Check authentication status
  useEffect(() => {
    if (provider && interceptedPayload) {
      // Check if we have valid intercepted data
      const hasValidData =
        interceptedPayload.response?.body &&
        interceptedPayload.response?.status === 200;

      if (hasValidData) {
        setIsAuthenticated(true);
        handleSuccess();
      }
    }
  }, [provider, interceptedPayload, handleSuccess]);

  // Client methods
  const signalIntent = useCallback(async (params: SignalIntentParams) => {
    try {
      const client = getClient();
      setIsClientInitialized(true);
      return await client.signalIntent(params);
    } catch (error) {
      console.error('Error signaling intent:', error);
      throw error;
    }
  }, []);

  const fulfillIntent = useCallback(async (params: FulfillIntentParams) => {
    try {
      const client = getClient();
      return await client.fulfillIntent(params);
    } catch (error) {
      console.error('Error fulfilling intent:', error);
      throw error;
    }
  }, []);

  // Transaction selection
  const handleTransactionSelect = useCallback(
    (transaction: ExtractedTransaction) => {
      setSelectedTransaction(transaction);
    },
    []
  );

  // Proof generation
  const generateProof = useCallback(
    async (
      provider: ProviderSettings,
      transaction: ExtractedTransaction,
      interceptedPayload: NetworkEvent,
      intentHash: string
    ) => {
      if (!transaction || !interceptedPayload || !provider) {
        throw new Error('Missing required data for proof generation');
      }

      return generateProofBase(
        provider,
        transaction,
        interceptedPayload,
        intentHash
      );
    },
    [selectedTransaction, interceptedPayload, provider, generateProofBase]
  );

  // Handle intercepted data
  useEffect(() => {
    if (provider && interceptedPayload) {
      const extractTransactions = async () => {
        const extractedTransactions = await extractTransactionsData(
          provider,
          interceptedPayload
        );
        setTransactions(extractedTransactions);
      };
      extractTransactions();
    }
  }, [provider, interceptedPayload, extractTransactionsData]);

  return {
    // Client state
    isClientInitialized,

    // Intent flow
    signalIntent,
    fulfillIntent,

    // Authentication flow
    provider,
    startAuthentication,
    handleError,
    handleSuccess,
    isAuthenticating,
    error,
    isAuthenticated,
    isCheckingStoredAuth,
    checkStoredAuth,

    // Transaction flow
    transactions,
    selectedTransaction,
    handleTransactionSelect,

    // Proof generation flow
    isGeneratingProof,
    claimData,
    generateProof,
    isWebViewReady,
    handleRPCMessage,
    handleWebViewLoad,
    handleWebViewError,

    // WebView refs
    rpcWebViewRef,

    // Intercepted data
    interceptedPayload,
  };
};
