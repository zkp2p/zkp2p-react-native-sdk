import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';
import { Modal, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type WindowRPCIncomingMsg,
  type RPCCreateClaimOptions,
  type CreateClaimResponse,
} from '@zkp2p/reclaim-witness-sdk';
import type { WalletClient } from 'viem';
import { DEFAULT_USER_AGENT } from '../utils/constants';
import {
  type ProviderSettings,
  type ExtractedItemsList,
  type Zkp2pClientOptions,
  type PendingEntry,
  type NetworkEvent,
  type RPCResponse,
} from '../types';
import { Zkp2pClient } from '../client';
import { InterceptWebView } from '@zkp2p/react-native-webview-intercept';
import { JSONPath } from 'jsonpath-plus';
import { extractItemsList, safeStringify } from './utils';
import { RPCWebView } from '../components/RPCWebView';
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import CookieManager from '@react-native-cookies/cookies';

import Zkp2pContext from './Zkp2pContext';

interface Zkp2pProviderProps {
  children: ReactNode;
  witnessUrl?: string;
  zkEngine?: 'snarkjs';
  configBaseUrl?: string;
  rpcTimeout?: number;
  walletClient: WalletClient;
  apiKey?: string;
  chainId?: number;
  baseApiUrl?: string;
}

export interface AuthWVOverrides
  extends Partial<React.ComponentProps<typeof InterceptWebView>> {}

const Zkp2pProvider = ({
  children,
  witnessUrl = 'https://witness-proxy.zkp2p.xyz',
  zkEngine = 'snarkjs',
  configBaseUrl = 'https://raw.githubusercontent.com/zkp2p/providers/main/',
  rpcTimeout = 30_000,
  walletClient,
  apiKey,
  chainId = 8453,
  baseApiUrl = 'https://api-staging.zkp2p.xyz/v1',
}: Zkp2pProviderProps) => {
  const zkp2pClient = useMemo(() => {
    if (!apiKey) {
      console.warn('apiKey missing');
      return null;
    }
    const clientOptions: Zkp2pClientOptions = {
      walletClient,
      apiKey,
      chainId,
      witnessUrl, // witnessUrl from props is passed here
    };
    if (baseApiUrl) {
      clientOptions.baseApiUrl = baseApiUrl;
    }
    return new Zkp2pClient(clientOptions);
  }, [walletClient, apiKey, chainId, witnessUrl, baseApiUrl]);

  const rpcWebViewRef = useRef<WebView>(null);
  const pending = useRef<Record<string, PendingEntry>>({});

  /*
   * State
   */
  const [provider, setProvider] = useState<ProviderSettings | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [authWebViewProps, setAuthWebViewProps] = useState<React.ComponentProps<
    typeof InterceptWebView
  > | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rpcKey, setRpcKey] = useState(0);

  const [interceptedPayload, setInterceptedPayload] =
    useState<NetworkEvent | null>(null);
  const [itemsList, setItemsList] = useState<ExtractedItemsList[]>([]);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [claimData, setClaimData] = useState<CreateClaimResponse | null>(null);

  /*
   * Methods
   */
  const fetchProviderConfig = useCallback(
    async (platform: string, actionType: string) => {
      const res = await fetch(`${configBaseUrl}${platform}/${actionType}.json`);
      if (!res.ok) throw new Error(`Provider config HTTP ${res.status}`);
      return (await res.json()) as ProviderSettings;
    },
    [configBaseUrl]
  );

  const restoreSessionWith = useCallback(
    async (cfg: ProviderSettings) => {
      const key = `intercepted_payload_${cfg.metadata.platform}_${cfg.actionType}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return false;

      const payload: NetworkEvent = JSON.parse(raw);

      if (payload.request.cookie) {
        await CookieManager.setFromResponse(
          payload.request.url,
          payload.request.cookie
        );
      }
      const replayOpts: RequestInit = {
        method: payload.request.method,
        headers: {
          ...payload.request.headers,
          'User-Agent': DEFAULT_USER_AGENT,
        },
        credentials: 'include',
      };
      if (
        payload.request.method !== 'GET' &&
        payload.request.method !== 'HEAD' &&
        payload.request.body
      ) {
        replayOpts.body = payload.request.body;
      }
      if (payload.request.cookie) {
        replayOpts.headers = {
          ...replayOpts.headers,
          Cookie: payload.request.cookie,
        };
      }
      const res = await fetch(payload.request.url, replayOpts);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();

      setInterceptedPayload(payload);
      setItemsList(extractItemsList(body, cfg));
      setIsAuthenticated(true);
      return true;
    },
    [setInterceptedPayload, setItemsList, setIsAuthenticated]
  );

  const startAuthentication = useCallback(
    async (
      platform: string,
      actionType: string,
      overrides: AuthWVOverrides = {}
    ) => {
      setIsAuthenticating(true);
      try {
        const cfg = await fetchProviderConfig(platform, actionType);
        console.log('Setting provider:', cfg);
        setProvider(cfg);

        try {
          const reused = await restoreSessionWith(cfg);
          if (reused) {
            console.log('↪︎ reused stored session – skipping WebView');
            return cfg;
          }
        } catch (err) {
          console.warn('stored session invalid – falling back to WebView');
        }

        setAuthWebViewProps({
          source: { uri: cfg.authLink },
          urlPatterns: [cfg.metadata.urlRegex, cfg.metadata.fallbackUrlRegex],
          userAgent: DEFAULT_USER_AGENT,
          interceptConfig: {
            xhr: true,
            fetch: true,
            html: true,
            maxBodyBytes: 10 * 1024 * 1024,
          },
          style: { flex: 1 },
          onIntercept: async (evt: NetworkEvent) => {
            console.log('onIntercept', evt);
            const { metadata } = cfg;
            const primaryHit =
              evt.request.method === metadata.method &&
              new RegExp(metadata.urlRegex).test(evt.response.url);

            const fallbackHit =
              evt.request.method === metadata.fallbackMethod &&
              new RegExp(metadata.fallbackUrlRegex).test(evt.response.url);

            if (!primaryHit && !fallbackHit) {
              console.log(
                '[zkp2p] intercept ignored:',
                evt.request.method,
                evt.response.url
              );
              return;
            }

            await AsyncStorage.setItem(
              `intercepted_payload_${metadata.platform}_${cfg.actionType}`,
              safeStringify(evt)
            );

            let jsonBody: any;

            try {
              if (primaryHit) {
                const raw = metadata.preprocessRegex
                  ? ((evt.response.body ?? '').match(
                      new RegExp(metadata.preprocessRegex)
                    )?.[1] ?? '{}')
                  : (evt.response.body ?? '{}');

                jsonBody = JSON.parse(raw);
              } else {
                if (evt.request.cookie) {
                  await CookieManager.setFromResponse(
                    evt.request.url,
                    evt.request.cookie
                  );
                }
                const replayOpts: RequestInit = {
                  method: metadata.method,
                  headers: {
                    ...evt.request.headers,
                    'User-Agent': DEFAULT_USER_AGENT,
                  },
                  credentials: 'include',
                };
                if (
                  metadata.method !== 'GET' &&
                  metadata.method !== 'HEAD' &&
                  cfg.body
                ) {
                  replayOpts.body = cfg.body;
                }
                if (evt.request.cookie) {
                  replayOpts.headers = {
                    ...replayOpts.headers,
                    Cookie: evt.request.cookie,
                  };
                }

                const resp = await fetch(cfg.url, replayOpts);
                jsonBody = await resp.json();
              }

              let txs: ExtractedItemsList[] = [];
              txs = extractItemsList(jsonBody, cfg);
              if (txs.length === 0) {
                setAuthWebViewProps(null); // Close the WebView
                setAuthError(new Error('Unauthorized (401)'));
                return;
              }

              setIsAuthenticated(true);
              setInterceptedPayload(evt);
              setItemsList(txs);
              setAuthWebViewProps(null); // close the modal
            } catch (err) {
              console.error('[zkp2p] failed to retrieve JSON body:', err);
              setAuthError(err as Error);
              setAuthWebViewProps(null);
            }
          },
          onError: (e: WebViewErrorEvent) => {
            console.error('auth webview error', e);
            setAuthError(new Error(String(e.nativeEvent?.description ?? e)));
            setAuthWebViewProps(null);
          },
          ...overrides,
        });

        return cfg;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [fetchProviderConfig, restoreSessionWith]
  );

  const closeAuthWebView = () => setAuthWebViewProps(null);

  const rpcRequest = useCallback(
    async (
      type: 'createClaim',
      req: RPCCreateClaimOptions,
      onStep?: (msg: RPCResponse) => void
    ): Promise<RPCResponse> => {
      if (!rpcWebViewRef.current) throw new Error('RPC WebView not ready');

      const id = Math.random().toString(16).slice(2);
      const msg: WindowRPCIncomingMsg = {
        module: 'attestor-core',
        id,
        type,
        channel: 'ReactNativeWebView',
        request: req,
      };

      const promise = new Promise<RPCResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          delete pending.current[id];
          reject(new Error('RPC timeout'));
        }, rpcTimeout);

        pending.current[id] = { resolve, reject, timeout, onStep };
      });

      console.log('Sending RPC message:', msg);

      rpcWebViewRef.current.postMessage(JSON.stringify(msg));
      return promise;
    },
    [rpcTimeout]
  );

  const onRpcMessage = useCallback((e: WebViewMessageEvent) => {
    console.log('dataNative', e.nativeEvent.data);
    try {
      const data: RPCResponse = JSON.parse(e.nativeEvent.data);
      console.log('RPC WebView message:', data);

      if (!data.module || data.module !== 'attestor-core') {
        return;
      }

      const { id, type } = data;
      if (type === 'createClaimStep') {
        // Handle step updates
        console.log('Proof generation step:', data.step);
      } else if (type === 'createClaimDone') {
        // Handle successful completion
        pending.current[id]?.resolve(data);
        delete pending.current[id];
      } else if (type === 'error') {
        // Handle errors
        const error = new Error(data.error?.data.message || 'Unknown error');
        if (data.error?.data.stack) {
          error.stack = data.error.data.stack;
        }
        pending.current[id]?.reject(error);
        delete pending.current[id];
      }
    } catch (error) {
      console.error('Failed to parse RPC message:', error);
    }
  }, []);

  const rpcWebViewProps = {
    ref: rpcWebViewRef,
    witnessUrl,
    onMessage: onRpcMessage,
  } as const;

  const generateProof = useCallback(
    async (
      providerCfg: ProviderSettings,
      payload: NetworkEvent,
      intentHash: string,
      itemIndex: number = 0
    ) => {
      if (!payload) throw new Error('No intercepted payload available');

      setIsGeneratingProof(true);
      setClaimData(null);
      try {
        let body = payload.response.body ?? '{}';
        if (providerCfg.metadata.preprocessRegex) {
          const m = body.match(
            new RegExp(providerCfg.metadata.preprocessRegex)
          );
          if (m?.[1]) body = m[1];
        }
        const headersArray = Object.entries(payload.request.headers);
        const headersToSend: Record<string, string> =
          providerCfg.skipRequestHeaders.length > 0
            ? headersArray.reduce(
                (acc, [name, value]) => {
                  if (!providerCfg.skipRequestHeaders.includes(name)) {
                    acc[name] = value;
                  }
                  return acc;
                },
                {} as Record<string, string>
              )
            : {};
        headersToSend['User-Agent'] = DEFAULT_USER_AGENT || '';
        const paramValues: Record<string, string> = {};
        providerCfg.paramNames?.forEach((name, idx) => {
          const sel = providerCfg.paramSelectors?.[idx];
          if (!sel) return;
          if (sel.type === 'jsonPath') {
            const val = (
              JSONPath({
                path: sel.value.replace('{{INDEX}}', String(itemIndex)),
                json: JSON.parse(body),
                resultType: 'value',
              }) as any[]
            )[0];
            paramValues[name] = String(val ?? '');
          } else {
            const m = body.match(new RegExp(sel.value));
            if (m?.[1]) paramValues[name] = m[1];
          }
        });
        const secret: { headers: Record<string, string>; cookieStr?: string } =
          { headers: {} };
        providerCfg.secretHeaders?.forEach((h) => {
          h === 'Cookie'
            ? (secret.cookieStr = payload.request.cookie ?? '')
            : (secret.headers[h] = payload.request.headers[h] ?? '');
        });
        const rpc: RPCCreateClaimOptions = {
          name: 'http',
          context: JSON.stringify({
            contextAddress: '0x0',
            contextMessage: intentHash,
          }),
          params: {
            url: providerCfg.url,
            method: providerCfg.method,
            body: providerCfg.body,
            headers: headersToSend,
            paramValues,
            responseMatches: providerCfg.responseMatches,
            responseRedactions: providerCfg.responseRedactions?.map((r) => ({
              jsonPath: r.jsonPath?.replace('{{INDEX}}', String(itemIndex)),
              regex: r.regex?.replace('{{INDEX}}', String(itemIndex)),
              xPath: r.xPath?.replace('{{INDEX}}', String(itemIndex)),
            })),
            ...(providerCfg.countryCode
              ? { geoLocation: providerCfg.countryCode }
              : {}),
          },
          secretParams: secret,
          ownerPrivateKey:
            '0x0123788edad59d7c013cdc85e4372f350f828e2cec62d9a2de4560e69aec7f89',
          client: { url: witnessUrl },
          zkProofConcurrency: 1,
          zkEngine,
        };
        console.log('RPC request:', rpc);
        const res = await rpcRequest('createClaim', rpc);
        console.log('RPC response:', res);
        setClaimData(res.response?.claimData ?? null);
        return res;
      } finally {
        setIsGeneratingProof(false);
        setRpcKey((k) => k + 1);
      }
    },
    [rpcRequest, zkEngine, witnessUrl]
  );

  /*
   * Effects
   */
  useEffect(
    () => () => {
      Object.values(pending.current).forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error('Component unmounted'));
      });
    },
    []
  );

  /*
   * Component
   */
  return (
    <Zkp2pContext.Provider
      value={{
        provider,
        isAuthenticating,
        authError,
        startAuthentication,
        authWebViewProps,
        closeAuthWebView,
        itemsList,
        isAuthenticated,
        interceptedPayload,
        generateProof,
        isGeneratingProof,
        claimData,
        zkp2pClient,
      }}
    >
      {children}
      {/* Auth WebView */}
      {authWebViewProps && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={closeAuthWebView}
        >
          <View style={styles.nativeBackdrop}>
            <View style={styles.nativeWebviewContainer}>
              <View style={styles.nativeHeader}>
                <TouchableOpacity
                  onPress={closeAuthWebView}
                  style={styles.nativeCloseButton}
                >
                  <Text style={styles.nativeCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <InterceptWebView
                {...authWebViewProps}
                // additionalCookieDomainsToInclude={['mercadolibre.com', 'www.mercadolibre.com']}
                style={styles.nativeWebview}
              />
            </View>
          </View>
        </Modal>
      )}
      {/* Hidden RPC WebView */}
      <RPCWebView key={rpcKey} {...rpcWebViewProps} />
    </Zkp2pContext.Provider>
  );
};

const styles = StyleSheet.create({
  nativeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  nativeWebviewContainer: {
    width: '100%',
    height: '90%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  nativeHeader: {
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingRight: 16,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 10,
  },
  nativeCloseButton: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    padding: 6,
  },
  nativeCloseText: { fontSize: 24, color: '#888' },
  nativeWebview: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default Zkp2pProvider;
