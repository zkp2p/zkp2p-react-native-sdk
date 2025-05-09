import { useCallback, useRef, useState } from 'react';
import type {
  WindowRPCIncomingMsg,
  CreateClaimResponse,
  RPCCreateClaimOptions,
} from '@zkp2p/reclaim-witness-sdk';
import type {
  ProviderSettings,
  ExtractedTransaction,
  NetworkEvent,
} from '../types';
import { JSONPath } from 'jsonpath-plus';
import { DEFAULT_WITNESS_URL } from '../utils/constants';
import type { WebView } from 'react-native-webview';
import { Platform } from 'react-native';

const DEFAULT_USER_AGENT = Platform.select({
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15.0 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
});

interface WindowRPCResponse {
  module: 'attestor-core';
  channel?: string;
  id: string;
  type: string;
  response?: any;
  step?: any;
  error?: {
    data: {
      message: string;
      stack?: string;
    };
  };
}

export const useProofGeneration = () => {
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [claimData, setClaimData] = useState<CreateClaimResponse | null>(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const rpcWebViewRef = useRef<WebView>(null);
  const pendingRpcs = useRef<{
    [key: string]: {
      resolve: (response: WindowRPCResponse) => void;
      reject: (error: Error) => void;
    };
  }>({});

  const rpcRequest = useCallback(
    async (
      type: 'createClaim',
      request: RPCCreateClaimOptions
    ): Promise<any> => {
      if (!rpcWebViewRef.current) {
        throw new Error('RPC WebView not initialized');
      }

      console.log('request', request);
      const requestId = Math.random().toString(16).replace('.', '');
      const req: WindowRPCIncomingMsg = {
        module: 'attestor-core',
        id: requestId,
        type,
        channel: 'ReactNativeWebView',
        request,
      };

      const promise = new Promise((resolve, reject) => {
        pendingRpcs.current[requestId] = { resolve, reject };
        // Add timeout for RPC requests
        setTimeout(() => {
          if (pendingRpcs.current[requestId]) {
            delete pendingRpcs.current[requestId];
            reject(new Error('RPC request timed out'));
          }
        }, 30000); // 30 second timeout
      });

      try {
        rpcWebViewRef.current.postMessage(JSON.stringify(req));
        console.log('RPC request:', req);
      } catch (error: any) {
        delete pendingRpcs.current[requestId];
        throw new Error(`Failed to send RPC request: ${error.message}`);
      }

      return promise;
    },
    []
  );

  const handleRPCMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Received RPC message:', data);

      // Handle RPC response
      if (data.id && pendingRpcs.current[data.id]) {
        const pendingRpc = pendingRpcs.current[data.id]!;
        if (data.error) {
          pendingRpc.reject(new Error(data.error.data?.message || 'RPC error'));
        } else {
          pendingRpc.resolve(data);
        }
        delete pendingRpcs.current[data.id];
      }

      // Handle proof generation response
      if (data.type === 'createClaimDone') {
        setClaimData(data.response.claimData);
        setIsGeneratingProof(false);
      }
    } catch (error) {
      console.error('Error handling RPC message:', error);
    }
  }, []);

  const handleWebViewLoad = useCallback(() => {
    setIsWebViewReady(true);
  }, []);

  const handleWebViewError = useCallback((error: any) => {
    console.error('WebView error:', error);
    setIsWebViewReady(false);
  }, []);

  const generateProof = useCallback(
    async (
      provider: ProviderSettings,
      transaction: ExtractedTransaction,
      interceptedPayload: NetworkEvent,
      intentHash: string
    ) => {
      if (!rpcWebViewRef.current) {
        throw new Error('RPC WebView not initialized');
      }

      setIsGeneratingProof(true);
      setClaimData(null);

      try {
        // Handle preprocess regex if exists
        let responseBody = interceptedPayload.response.body || '{}';
        if (provider.metadata.preprocessRegex) {
          const preprocessRegex = new RegExp(provider.metadata.preprocessRegex);
          const preprocessedResponseBody = responseBody.match(preprocessRegex);
          if (preprocessedResponseBody && preprocessedResponseBody[1]) {
            responseBody = preprocessedResponseBody[1];
          }
        }

        // Build headers from the intercepted request
        const headers: { [k: string]: string } = {};
        const headersToSend: { [k: string]: string } = {};

        Object.entries(interceptedPayload?.request?.headers || {}).forEach(
          ([name, value]) => {
            headers[name] = value as string;
            if (
              provider.skipRequestHeaders.length > 0 &&
              !provider.skipRequestHeaders?.includes(name)
            ) {
              headersToSend[name] = value as string;
            }
          }
        );
        headersToSend['User-Agent'] = DEFAULT_USER_AGENT as string;

        // Build param values from response body
        let paramValues = {} as { [key: string]: string };
        provider.paramNames?.forEach((paramName, index) => {
          const selector = provider.paramSelectors?.[index];
          if (!selector) return;

          switch (selector.type) {
            case 'jsonPath':
              const jsonPath = selector.value.replace(
                '{{INDEX}}',
                transaction.originalIndex.toString()
              );
              const metadataPath = JSONPath({
                path: jsonPath,
                json: JSON.parse(responseBody),
                resultType: 'value',
              }) as any[];
              paramValues[paramName] = String(metadataPath[0] || '');
              break;
            case 'regex':
              const regex = new RegExp(selector.value);
              const matches = responseBody.match(regex);
              if (matches && matches[1]) {
                paramValues[paramName] = matches[1];
              }
              break;
          }
        });

        // Build secret params
        let secretParams = { headers: {} } as {
          headers: { [key: string]: string };
          [key: string]: any;
        };
        provider.secretHeaders?.forEach((headerName) => {
          if (headerName === 'Cookie') {
            secretParams.cookieStr = interceptedPayload.request.cookie || '';
          } else {
            secretParams.headers[headerName] = headers[headerName] || '';
          }
        });

        // Create claim request
        const claimParams = {
          name: 'http',
          context: JSON.stringify({
            contextAddress: '0x0',
            contextMessage: intentHash,
          }),
          params: {
            url: provider.url,
            method: provider.method,
            body: provider.body,
            headers: headersToSend,
            paramValues: paramValues,
            responseMatches: provider.responseMatches,
            responseRedactions:
              provider.responseRedactions?.map((redaction) => {
                let redactionParams: { [key: string]: string } = {};
                if (redaction.jsonPath) {
                  redactionParams.jsonPath = redaction.jsonPath.replace(
                    '{{INDEX}}',
                    transaction.originalIndex.toString()
                  );
                }
                if (redaction.regex) {
                  redactionParams.regex = redaction.regex.replace(
                    '{{INDEX}}',
                    transaction.originalIndex.toString()
                  );
                }
                if (redaction.xPath) {
                  redactionParams.xPath = redaction.xPath.replace(
                    '{{INDEX}}',
                    transaction.originalIndex.toString()
                  );
                }
                return redactionParams;
              }) || [],
          },
          secretParams: secretParams,
          ownerPrivateKey:
            '0x0123788edad59d7c013cdc85e4372f350f828e2cec62d9a2de4560e69aec7f89',
          client: { url: DEFAULT_WITNESS_URL },
          zkProofConcurrency: 4,
          zkEngine: 'snarkjs' as const, // TODO: make this dynamic
        };

        console.log('Sending claim request:', claimParams);
        const response = await rpcRequest('createClaim', claimParams);
        console.log('Received claim response:', response);
        return response;
      } catch (error) {
        console.error('Error generating proof:', error);
        setIsGeneratingProof(false);
        setClaimData(null);
        throw error;
      }
    },
    [rpcRequest]
  );

  return {
    isGeneratingProof,
    claimData,
    generateProof,
    rpcWebViewRef,
    isWebViewReady,
    handleRPCMessage,
    handleWebViewLoad,
    handleWebViewError,
  };
};
