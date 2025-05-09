import { createClient, getClient } from './client';
import { useAuthentication } from './hooks/useAuthentication';
import { useProofGeneration } from './hooks/useProofGeneration';
import { useTransactionExtraction } from './hooks/useTransactionExtraction';
import { useInterceptedPayload } from './hooks/useInterceptedPayload';
import { AuthenticationWebView } from './components/AuthenticationWebView';
import { RPCWebView } from './components/RPCWebView';
import type {
  ExtractedTransaction,
  NetworkEvent,
  ProviderSettings,
} from './types';

export {
  createClient,
  getClient,
  useAuthentication,
  useProofGeneration,
  useTransactionExtraction,
  useInterceptedPayload,
  AuthenticationWebView,
  RPCWebView,
};

export type { ExtractedTransaction, NetworkEvent, ProviderSettings };
