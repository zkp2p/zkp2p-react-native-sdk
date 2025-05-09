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
  const rpcWebViewRef = useRef<WebView>(null);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [claimData, setClaimData] = useState<any | null>(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
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
    console.log('dataNative', event.nativeEvent.data);
    try {
      const data: WindowRPCResponse = JSON.parse(event.nativeEvent.data);
      console.log('RPC WebView message:', data);

      if (!data.module || data.module !== 'attestor-core') {
        return;
      }

      const { id, type } = data;
      if (type === 'createClaimStep') {
        console.log('Proof generation step:', data.step);
      } else if (type === 'createClaimDone') {
        const pendingRpc = pendingRpcs.current[id];
        if (pendingRpc) {
          pendingRpc.resolve(data);
          delete pendingRpcs.current[id];
        }
      } else if (type === 'error') {
        const pendingRpc = pendingRpcs.current[id];
        if (pendingRpc) {
          const error = new Error(data.error?.data.message || 'Unknown error');
          if (data.error?.data.stack) {
            error.stack = data.error.data.stack;
          }
          pendingRpc.reject(error);
          delete pendingRpcs.current[id];
        }
      }
    } catch (error) {
      console.error('Failed to parse RPC message:', error);
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
    ): Promise<CreateClaimResponse> => {
      if (!isWebViewReady) {
        throw new Error('RPC WebView is not ready');
      }

      setIsGeneratingProof(true);
      setClaimData(null);
      try {
        const wait = new Promise((resolve) =>
          setTimeout(resolve, 10000 + Math.random() * 5000)
        );
        const proofPromise = (async () => {
          console.log('Payload request:', interceptedPayload);

          // Build headers from the intercepted request
          const headers: { [k: string]: string } = {};
          const headersToSend: { [k: string]: string } = {};

          Object.entries(interceptedPayload?.request?.headers || {}).forEach(
            ([name, value]) => {
              headers[name] = value as string;
              if (!provider.skipRequestHeaders?.includes(name)) {
                headersToSend[name] = value as string;
              }
            }
          );
          headersToSend['User-Agent'] = DEFAULT_USER_AGENT as string;

          console.log('headersToSend:', headersToSend);

          // Build param values from response body
          let paramValues = {} as { [key: string]: string };
          const responseBody = interceptedPayload?.response?.body || '{}';
          console.log('Response body:', responseBody);

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
                });
                paramValues[paramName] = String(metadataPath[0]);
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
            console.log('Header name:', headerName);
            console.log('headers:', headers);
            if (headerName === 'Cookie') {
              console.log('cookiestr:', headers);
              secretParams.cookieStr = interceptedPayload.request.cookie;
            } else {
              secretParams.headers[headerName] = headers[headerName] || '';
            }
          });

          console.log('secretParams:', secretParams);

          // Create claim request
          const response = await rpcRequest('createClaim', {
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
            zkEngine: 'snarkjs',
          });

          return response;
        })();

        const [response] = await Promise.all([proofPromise, wait]);
        setClaimData(
          response?.claimData || response?.response?.claimData || null
        );
        return response;
      } catch (error) {
        throw error;
      } finally {
        setIsGeneratingProof(false);
      }
    },
    [rpcRequest, isWebViewReady]
  );

  return {
    rpcWebViewRef,
    isGeneratingProof,
    claimData,
    isWebViewReady,
    handleRPCMessage,
    handleWebViewLoad,
    handleWebViewError,
    generateProof,
  };
};
