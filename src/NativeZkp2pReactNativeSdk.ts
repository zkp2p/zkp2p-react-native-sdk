import type { CreateClaimResponse } from '@zkp2p/reclaim-witness-sdk';
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface NetworkEvent {
  request: {
    url: string;
    method: string;
    headers: { [key: string]: string };
    cookie?: string;
  };
  response?: {
    body: string;
  };
}

export interface ExtractedTransaction {
  recipient: string;
  amount: string;
  date: string;
  paymentId: string;
  currency: string;
  hidden: boolean;
  originalIndex: number;
}

export interface ProviderSettings {
  actionType: string;
  authLink: string;
  url: string;
  method: string;
  skipRequestHeaders?: string[];
  body?: string;
  metadata: {
    transactionsExtraction?: {
      transactionJsonPathListSelector: string;
      transactionJsonPathSelectors: {
        recipient?: string;
        amount?: string;
        date?: string;
        paymentId?: string;
        currency?: string;
      };
    };
  };
  paramNames?: string[];
  paramSelectors?: Array<{
    type: 'jsonPath' | 'regex';
    value: string;
  }>;
  secretHeaders?: string[];
  responseMatches?: Array<{
    type: 'jsonPath' | 'regex';
    value: string;
  }>;
  responseRedactions?: Array<{
    jsonPath?: string;
    regex?: string;
    xPath?: string;
  }>;
}

export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
  startAuthentication(provider: ProviderSettings): Promise<void>;
  handleSuccess(provider: ProviderSettings): Promise<void>;
  handleError(errorMessage: string): Promise<void>;
  generateProof(
    provider: ProviderSettings,
    transaction: ExtractedTransaction,
    interceptedPayload: NetworkEvent,
    intentHash: string
  ): Promise<CreateClaimResponse>;
  handleIntercept(event: NetworkEvent): Promise<void>;
  extractTransactionsData(
    provider: ProviderSettings,
    jsonResponseBody: string
  ): Promise<ExtractedTransaction[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Zkp2pReactNativeSdk');
