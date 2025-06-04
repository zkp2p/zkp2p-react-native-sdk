import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type WindowRPCIncomingMsg,
  type RPCCreateClaimOptions,
} from '@zkp2p/reclaim-witness-sdk';
import type { WalletClient } from 'viem';
import { DEFAULT_USER_AGENT } from '../utils/constants';
import {
  type ProviderSettings,
  type ExtractedMetadataList,
  type Zkp2pClientOptions,
  type PendingEntry,
  type NetworkEvent,
  type RPCResponse,
  type ProofData,
  type FlowState,
  type InitiateOptions,
} from '../types';
import { Zkp2pClient } from '../client';
import { InterceptWebView } from '@zkp2p/react-native-webview-intercept';
import { JSONPath } from 'jsonpath-plus';
import { extractMetadata, safeStringify } from './utils';
import { RPCWebView } from '../components/RPCWebView';
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import CookieManager from '@react-native-cookies/cookies';

import Zkp2pContext from './Zkp2pContext';
import { parseReclaimProxyProof } from '../utils/reclaimProof';

interface Zkp2pProviderProps {
  children: ReactNode;
  witnessUrl?: string;
  prover?: 'reclaim_gnark' | 'reclaim_snarkjs' | 'primus_proxy';
  configBaseUrl?: string;
  rpcTimeout?: number;
  walletClient: WalletClient;
  apiKey?: string;
  chainId?: number;
  baseApiUrl?: string;
}

const Zkp2pProvider = ({
  children,
  prover = 'reclaim_snarkjs',
  witnessUrl = 'https://witness-proxy.zkp2p.xyz',
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
      prover,
      walletClient,
      apiKey,
      chainId,
      witnessUrl, // witnessUrl from props is passed here
    };
    if (baseApiUrl) {
      clientOptions.baseApiUrl = baseApiUrl;
    }
    return new Zkp2pClient(clientOptions);
  }, [walletClient, apiKey, chainId, witnessUrl, baseApiUrl, prover]);

  const rpcWebViewRef = useRef<WebView>(null);
  const pending = useRef<Record<string, PendingEntry>>({});

  /*
   * State
   */
  const [provider, setProvider] = useState<ProviderSettings | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [authError, setAuthError] = useState<Error | null>(null);
  const [metadataList, setMetadataList] = useState<ExtractedMetadataList[]>([]);
  const [interceptedPayload, setInterceptedPayload] =
    useState<NetworkEvent | null>(null);
  const [authWebViewProps, setAuthWebViewProps] = useState<React.ComponentProps<
    typeof InterceptWebView
  > | null>(null);
  const [rpcKey, setRpcKey] = useState(0);

  const [proofData, setProofData] = useState<ProofData | null>(null);

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
      setMetadataList(extractMetadata(body, cfg));
      setFlowState('authenticated');
      return true;
    },
    [setInterceptedPayload, setMetadataList]
  );

  const _getOrFetchProviderConfig = useCallback(
    async (
      platform: string,
      actionType: string,
      currentProviderConfig: ProviderSettings | null
    ): Promise<ProviderSettings> => {
      if (
        currentProviderConfig &&
        currentProviderConfig.metadata.platform === platform &&
        currentProviderConfig.actionType === actionType
      ) {
        return currentProviderConfig;
      }
      const newCfg = await fetchProviderConfig(platform, actionType);
      setProvider(newCfg);
      console.log('Setting provider (via _getOrFetchProviderConfig):', newCfg);
      return newCfg;
    },
    [fetchProviderConfig, setProvider]
  );

  const _handleAuthIntercept = useCallback(
    async (evt: NetworkEvent, cfg: ProviderSettings) => {
      console.log('onIntercept (via _handleAuthIntercept)', evt);
      const { metadata } = cfg;
      const primaryHit =
        evt.request.method === metadata.method &&
        new RegExp(metadata.urlRegex).test(evt.response.url);

      const fallbackHit =
        metadata.fallbackUrlRegex &&
        evt.request.method === metadata.fallbackMethod &&
        new RegExp(metadata.fallbackUrlRegex).test(evt.response.url);

      if (!primaryHit && !fallbackHit) {
        console.log(
          '[zkp2p] intercept ignored (via _handleAuthIntercept):',
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
      let itemExtractionError: Error | null = null;

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
          if (!resp.ok)
            throw new Error(
              `Fallback replay HTTP ${resp.status} for ${cfg.url}`
            );
          jsonBody = await resp.json();
        }

        console.log(
          '[zkp2p] Attempting to extract items from JSON body (via _handleAuthIntercept):',
          jsonBody
        );
        const txs = extractMetadata(jsonBody, cfg);
        setMetadataList(txs);
        setInterceptedPayload(evt);
        setAuthWebViewProps(null);

        if (
          txs.length === 0 &&
          cfg.metadata.transactionsExtraction?.transactionJsonPathListSelector
        ) {
          itemExtractionError = new Error(
            'Authentication successful, but no transactions found where items were expected.'
          );
        }

        setFlowState('authenticated');
        setAuthError(itemExtractionError);
      } catch (err) {
        console.error(
          '[zkp2p] failed to retrieve/process JSON body (via _handleAuthIntercept):',
          err
        );
        setMetadataList([]);
        setInterceptedPayload(null);
        setAuthError(err as Error);
        setAuthWebViewProps(null);
        if (flowState === 'authenticating') setFlowState('idle');
      }
    },
    [
      flowState,
      setFlowState,
      setMetadataList,
      setInterceptedPayload,
      setAuthWebViewProps,
      setAuthError,
    ]
  );

  const _setupAuthWebViewProps = useCallback(
    (cfg: ProviderSettings) => {
      return {
        source: { uri: cfg.authLink },
        urlPatterns: [
          cfg.metadata.urlRegex,
          cfg.metadata.fallbackUrlRegex,
        ].filter(Boolean) as string[],
        userAgent: DEFAULT_USER_AGENT,
        interceptConfig: {
          xhr: true,
          fetch: true,
          html: true,
          maxBodyBytes: 10 * 1024 * 1024,
        },
        additionalCookieDomainsToInclude:
          cfg.mobile?.includeAdditionalCookieDomains ?? [],
        style: { flex: 1 },
        onIntercept: (evt: NetworkEvent) => _handleAuthIntercept(evt, cfg),
        onError: (e: WebViewErrorEvent) => {
          console.error(
            'auth webview error (via _setupAuthWebViewProps)',
            e.nativeEvent
          );
          setAuthError(new Error(String(e.nativeEvent?.description ?? e.type)));
          setAuthWebViewProps(null);
        },
      };
    },
    [_handleAuthIntercept, setAuthError, setAuthWebViewProps]
  );

  // Helper function to proceed to authentication flow
  const _authenticateInternal = useCallback(
    async (cfg: ProviderSettings) => {
      setFlowState('authenticating');

      try {
        const reused = await restoreSessionWith(cfg);
        if (reused) {
          setAuthWebViewProps(null);
          return;
        }
      } catch (err) {
        console.warn('[zkp2p] Stored session invalid:', err);
        setAuthError(err as Error);
      }

      console.log('[zkp2p] No session reused, setting up auth WebView.');
      const webViewProps = _setupAuthWebViewProps(cfg);
      setAuthWebViewProps(webViewProps);
    },
    [
      restoreSessionWith,
      setFlowState,
      setAuthError,
      setAuthWebViewProps,
      _setupAuthWebViewProps,
    ]
  );

  // Helper function to handle HTTP actions in WebView
  const _handleHttpActionInWebView = useCallback(
    async (
      effectiveActionUrl: string,
      cfg: ProviderSettings,
      initialAction: NonNullable<InitiateOptions['initialAction']>
    ) => {
      setFlowState('actionStarted');

      setAuthWebViewProps({
        source: { uri: effectiveActionUrl },
        urlPatterns: [],
        userAgent: DEFAULT_USER_AGENT,
        interceptConfig: { xhr: false, fetch: false, html: false },
        additionalCookieDomainsToInclude:
          cfg.mobile?.includeAdditionalCookieDomains ?? [],
        style: { flex: 1 },
        onIntercept: (evt: NetworkEvent) => {
          console.log(
            '[zkp2p] Intercept during action phase (should be off):',
            evt.request.method,
            evt.response.url
          );
        },
        injectedJavaScript: ` 
          (function() { 
            const buttonOpts = ${JSON.stringify(initialAction.buttonOptions || {})};
            if (buttonOpts.hide) return;
            const button = document.createElement('button');
            button.innerHTML = buttonOpts.text || 'Continue to Authentication';
            const defaultStyle = {
              position: 'fixed', zIndex: '9999', padding: '12px 24px',
              backgroundColor: '#007AFF', color: 'white', border: 'none',
              borderRadius: '8px', fontSize: '16px', fontWeight: '600',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)',
              transition: 'all 0.2s ease', width: 'auto', margin: '0'
            };
            const position = buttonOpts.position || 'bottom';
            if (position === 'bottom') { defaultStyle.right = '20px'; defaultStyle.bottom = '20px'; }
            else if (position === 'top') { defaultStyle.top = '20px'; defaultStyle.right = '20px'; }
            else if (position === 'center') { defaultStyle.top = '50%'; defaultStyle.left = '50%'; defaultStyle.transform = 'translate(-50%, -50%)'; }
            else if (position === 'bottom_center') { defaultStyle.bottom = '20px'; defaultStyle.left = '50%'; defaultStyle.transform = 'translateX(-50%)'; defaultStyle.width = 'calc(100% - 40px)'; defaultStyle.maxWidth = '300px'; }
            Object.assign(defaultStyle, buttonOpts.style || {});
            Object.entries(defaultStyle).forEach(([k, val]) => { button.style[k] = String(val); });
            button.addEventListener('mouseenter', function() { this.style.opacity = '0.9'; });
            button.addEventListener('mouseleave', function() { this.style.opacity = '1'; });
            button.onclick = function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CONTINUE_TO_AUTH_FROM_INITIAL_ACTION' }));
            };
            document.body.appendChild(button);
          })();
        `,
        onMessage: async (event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'CONTINUE_TO_AUTH_FROM_INITIAL_ACTION') {
              console.log(
                '[zkp2p] Proceeding to auth after initial HTTP action...'
              );
              await _authenticateInternal(cfg);
            }
          } catch (err) {
            console.error(
              '[zkp2p] Failed to parse WebView message from initial action:',
              err
            );
          }
        },
        onError: (e: WebViewErrorEvent) => {
          console.error(
            '[zkp2p] InitialAction WebView error:',
            e.nativeEvent?.description ?? e.type
          );
          setAuthError(new Error(String(e.nativeEvent?.description ?? e.type)));
          setAuthWebViewProps(null);
          setFlowState('idle');
        },
      });
    },
    [setFlowState, setAuthWebViewProps, setAuthError, _authenticateInternal]
  );

  // Helper function to handle external actions
  const _handleExternalAction = useCallback(
    async (
      actionUrl: string,
      initialAction: NonNullable<InitiateOptions['initialAction']>
    ) => {
      setFlowState('actionStarted');

      // Apply URL variable substitutions if provided
      let effectiveActionUrl = actionUrl;
      if (initialAction.urlVariables) {
        Object.entries(initialAction.urlVariables).forEach(([key, value]) => {
          effectiveActionUrl = effectiveActionUrl.replace(
            new RegExp(`{{${key}}}`, 'g'),
            value
          );
        });
        console.log(
          '[zkp2p] Effective Action URL with urlVariables:',
          effectiveActionUrl
        );
      }

      try {
        await Linking.openURL(effectiveActionUrl);
        console.log('[zkp2p] External action launched successfully.');
      } catch (linkErr) {
        console.error('[zkp2p] Failed to open external URL:', linkErr);
        setAuthError(
          new Error(`Failed to open action URL: ${effectiveActionUrl}`)
        );
        setFlowState('idle');
        throw linkErr;
      }
    },
    [setFlowState, setAuthError]
  );

  // Public method to manually proceed to authentication after external action
  const authenticate = useCallback(async () => {
    if (!provider) {
      throw new Error(
        'No provider configuration available. Call initiate first.'
      );
    }

    if (flowState !== 'actionStarted') {
      throw new Error('Must be in actionStarted state');
    }

    await _authenticateInternal(provider);
  }, [provider, flowState, _authenticateInternal]);

  // Helper function to handle initial action flow
  const _handleInitialAction = useCallback(
    async (
      cfg: ProviderSettings,
      initialAction: NonNullable<InitiateOptions['initialAction']>
    ) => {
      const effectiveActionUrl = cfg.mobile?.actionLink;

      if (!effectiveActionUrl) return;

      const isHttpUrl = effectiveActionUrl.startsWith('http');

      if (isHttpUrl) {
        // HTTP URL - open in WebView with continue button
        await _handleHttpActionInWebView(
          effectiveActionUrl,
          cfg,
          initialAction
        );
      } else {
        // Non-HTTP URL - open externally and wait for manual proceed or auto-proceed
        await _handleExternalAction(effectiveActionUrl, initialAction);
      }
    },
    [_handleHttpActionInWebView, _handleExternalAction]
  );

  const initiate = useCallback(
    async (
      platform: string,
      actionType: string,
      options: InitiateOptions = {}
    ): Promise<ProviderSettings> => {
      const { existingProviderConfig, initialAction } = options;

      // Reset state
      setAuthError(null);
      setMetadataList([]);
      setInterceptedPayload(null);

      // Get provider configuration
      const cfg =
        existingProviderConfig ??
        (await _getOrFetchProviderConfig(platform, actionType, provider));

      // Handle initial action if provided
      if (initialAction) {
        await _handleInitialAction(cfg, initialAction);
        return cfg;
      }

      // No initial action - proceed directly to authentication
      await _authenticateInternal(cfg);
      return cfg;
    },
    [
      _getOrFetchProviderConfig,
      provider,
      _handleInitialAction,
      _authenticateInternal,
      setAuthError,
      setMetadataList,
      setInterceptedPayload,
    ]
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
        console.log('Proof generation step:', data.step);
      } else if (type === 'createClaimDone') {
        pending.current[id]?.resolve(data);
        delete pending.current[id];
      } else if (type === 'error') {
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
      if (prover !== 'reclaim_snarkjs') {
        console.warn('Unsupported prover:', prover);
        return;
      }

      setFlowState('proofGenerating');
      setProofData(null);
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
          zkEngine: 'snarkjs',
        };
        console.log('RPC request:', rpc);
        const res = await rpcRequest('createClaim', rpc);
        console.log('RPC response:', res);

        // only reclaim proofs are supported at the moment
        const proof = parseReclaimProxyProof(res.response ?? null);
        console.log('Proof:', proof);
        setProofData({
          proofType: 'reclaim',
          proof: proof,
        });
        setFlowState('proofGeneratedSuccess');
        return res;
      } catch (err) {
        setFlowState('proofGeneratedFailure');
        throw err;
      } finally {
        setRpcKey((k) => k + 1);
      }
    },
    [rpcRequest, witnessUrl, prover, setFlowState, setProofData, setRpcKey]
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
        flowState,
        authError,
        metadataList,
        interceptedPayload,
        initiate,
        authenticate,
        authWebViewProps,
        closeAuthWebView,
        generateProof,
        proofData,
        zkp2pClient,
      }}
    >
      {children}
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
                style={styles.nativeWebview}
              />
            </View>
          </View>
        </Modal>
      )}
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
