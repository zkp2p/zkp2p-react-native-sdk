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
  Animated,
  Image,
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
  type AutoGenerateProofOptions,
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

  const [autoGenerateOptions, setAutoGenerateOptions] =
    useState<AutoGenerateProofOptions | null>(null);
  const [lastProofItemIndex, setLastProofItemIndex] = useState<number>(0);
  const [proofError, setProofError] = useState<Error | null>(null);

  const spinAnimation = useRef(new Animated.Value(0)).current;

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

        // Add a smooth close transition after authentication
        setTimeout(() => {
          setAuthWebViewProps(null);
        }, 300);
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
        console.log('reusing session', reused);
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
      actionUrl: string,
      cfg: ProviderSettings,
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
        onNavigationStateChange: async (navState) => {
          // Check if the current URL matches the target URL pattern
          if (
            cfg.mobile?.actionCompletedUrlRegex &&
            new RegExp(cfg.mobile?.actionCompletedUrlRegex).test(navState.url)
          ) {
            console.log(
              '[zkp2p] Target URL detected, proceeding to authentication...'
            );
            await _authenticateInternal(cfg);
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
  const authenticate = useCallback(
    async (autoGenerateProof?: AutoGenerateProofOptions) => {
      if (!provider) {
        throw new Error(
          'No provider configuration available. Call initiate first.'
        );
      }

      // Only update auto-generation options if explicitly provided
      // This allows manual authenticate() calls to override previous settings
      if (autoGenerateProof !== undefined) {
        setAutoGenerateOptions(autoGenerateProof || null);
      }

      await _authenticateInternal(provider);
    },
    [provider, _authenticateInternal]
  );

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
      const { existingProviderConfig, initialAction, autoGenerateProof } =
        options;

      // Reset state
      setAuthError(null);
      setMetadataList([]);
      setInterceptedPayload(null);
      setProofData(null);

      // Set auto-generation options once at the beginning
      // These will persist through the entire flow (action link → auth → proof)
      if (autoGenerateProof) {
        setAutoGenerateOptions(autoGenerateProof);
      } else {
        setAutoGenerateOptions(null);
      }

      // Get provider configuration
      const cfg =
        existingProviderConfig ??
        (await _getOrFetchProviderConfig(platform, actionType, provider));

      // Always handle action link if it exists
      if (cfg.mobile?.actionLink) {
        // If no initialAction provided, create default options
        const actionOptions = initialAction || { enabled: true };
        await _handleInitialAction(cfg, actionOptions);
        return cfg;
      }

      // No action link - proceed directly to authentication
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
      setProofError(null);
      setLastProofItemIndex(itemIndex);
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
        setProofError(err as Error);
        throw err;
      } finally {
        setRpcKey((k) => k + 1);
      }
    },
    [rpcRequest, witnessUrl, prover, setFlowState, setProofData, setRpcKey]
  );

  const _handleAutoGenerateProof = useCallback(
    async (
      cfg: ProviderSettings,
      payload: NetworkEvent,
      items: ExtractedMetadataList[],
      options: AutoGenerateProofOptions
    ) => {
      // Validate we have items to generate proof for
      const targetIndex = options.itemIndex ?? 0;
      if (!items || items.length === 0) {
        const error = new Error(
          'No transactions available for automatic proof generation'
        );
        console.error('[zkp2p] Auto-generation failed:', error);
        options.onProofError?.(error);
        return null;
      }

      if (targetIndex >= items.length) {
        const error = new Error(
          `Item index ${targetIndex} out of range (${items.length} items available)`
        );
        console.error('[zkp2p] Auto-generation failed:', error);
        options.onProofError?.(error);
        return null;
      }

      try {
        const intentHash =
          options.intentHash ||
          '0x0000000000000000000000000000000000000000000000000000000000000001';
        console.log(
          '[zkp2p] Starting automatic proof generation for item index:',
          targetIndex
        );

        const result = await generateProof(
          cfg,
          payload,
          intentHash,
          targetIndex
        );

        // Check if proof was generated successfully
        if (flowState === 'proofGeneratedSuccess' && proofData) {
          console.log('[zkp2p] Auto-generation successful');
          options.onProofGenerated?.(proofData);
        }

        return result;
      } catch (error) {
        console.error('[zkp2p] Auto-generation failed:', error);
        options.onProofError?.(error as Error);
        // Don't set flow state to idle - let it fall back to showing transactions
        return null;
      }
    },
    [generateProof, flowState, proofData]
  );

  /*
   * Effects
   */

  useEffect(() => {
    if (
      flowState === 'authenticated' &&
      autoGenerateOptions && // If it exists, it's enabled
      !proofData && // Only auto-generate if no proof exists yet
      provider &&
      interceptedPayload &&
      metadataList.length > 0 &&
      !authError
    ) {
      console.log('[zkp2p] Triggering auto-generation after authentication');
      _handleAutoGenerateProof(
        provider,
        interceptedPayload,
        metadataList,
        autoGenerateOptions
      );
    }
  }, [
    flowState,
    autoGenerateOptions,
    proofData,
    provider,
    interceptedPayload,
    metadataList,
    authError,
    _handleAutoGenerateProof,
  ]);

  // Animate spinner when proof is generating
  useEffect(() => {
    if (flowState === 'proofGenerating') {
      const animation = Animated.loop(
        Animated.timing(spinAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else if (flowState === 'proofGeneratedSuccess') {
      // Stop spinning on success
      spinAnimation.setValue(0);
      // Auto-close spinner after 2 seconds
      const timer = setTimeout(() => {
        setFlowState('idle');
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      spinAnimation.setValue(0);
      return () => {};
    }
  }, [flowState, spinAnimation]);

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
          <Animated.View
            style={[styles.nativeBackdrop, styles.nativeBackdropVisible]}
          >
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
          </Animated.View>
        </Modal>
      )}
      <RPCWebView key={rpcKey} {...rpcWebViewProps} />

      {/* Proof Generation Spinner */}
      {(flowState === 'proofGenerating' ||
        flowState === 'proofGeneratedSuccess' ||
        flowState === 'proofGeneratedFailure') && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={styles.proofSpinnerBackdrop}>
            <View style={styles.proofSpinnerCard}>
              <Text style={styles.proofSpinnerTitle}>
                {flowState === 'proofGeneratedSuccess'
                  ? 'Proof Generated!'
                  : flowState === 'proofGeneratedFailure'
                    ? 'Proof Generation Failed'
                    : 'Authenticating'}
              </Text>

              <View style={styles.proofSpinnerWrapper}>
                {/* Spinning ring */}
                <Animated.View
                  style={[
                    styles.proofSpinnerRing,
                    flowState !== 'proofGenerating' &&
                      styles.proofSpinnerRingNonGenerating,
                    {
                      transform: [
                        {
                          rotate: spinAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.proofSpinnerRingOuter,
                      flowState === 'proofGeneratedSuccess' &&
                        styles.proofSpinnerRingSuccess,
                      flowState === 'proofGeneratedFailure' &&
                        styles.proofSpinnerRingFailure,
                    ]}
                  />
                </Animated.View>

                {/* Logo in center */}
                {flowState === 'proofGeneratedFailure' ? (
                  <View
                    style={[
                      styles.proofSpinnerLogo,
                      styles.proofSpinnerLogoFailure,
                    ]}
                  >
                    <Text style={styles.proofSpinnerLogoText}>!</Text>
                  </View>
                ) : flowState === 'proofGeneratedSuccess' ? (
                  <View
                    style={[
                      styles.proofSpinnerLogo,
                      styles.proofSpinnerLogoSuccess,
                    ]}
                  >
                    <Text style={styles.proofSpinnerLogoText}>✓</Text>
                  </View>
                ) : (
                  <Image
                    source={require('../assets/logo192.png')}
                    style={styles.proofSpinnerLogoImage}
                  />
                )}
              </View>

              {flowState === 'proofGeneratedFailure' ? (
                <>
                  <Text style={styles.proofSpinnerSubtitle}>
                    {proofError?.message ||
                      'An error occurred while generating the proof'}
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={async () => {
                      if (!provider || !interceptedPayload) return;
                      try {
                        const intentHash =
                          '0x0000000000000000000000000000000000000000000000000000000000000001';
                        await generateProof(
                          provider,
                          interceptedPayload,
                          intentHash,
                          lastProofItemIndex
                        );
                      } catch (err) {
                        console.error('[zkp2p] Retry failed:', err);
                      }
                    }}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setFlowState('idle')}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.proofSpinnerSubtitle}>
                    {flowState === 'proofGeneratedSuccess'
                      ? 'Your proof is ready!'
                      : 'Creating cryptographic proof...'}
                  </Text>
                  {flowState === 'proofGenerating' && (
                    <Text style={styles.proofSpinnerSubtitle}>
                      This may take up to 30s
                    </Text>
                  )}
                </>
              )}

              <Text style={styles.proofSpinnerPoweredBy}>Powered by ZKP2P</Text>
            </View>
          </View>
        </Modal>
      )}
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
  nativeBackdropVisible: {
    opacity: 1,
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
  // Proof Generation Spinner Styles
  proofSpinnerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proofSpinnerCard: {
    backgroundColor: '#171717',
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 32,
    width: '90%',
    maxWidth: 400,
    minHeight: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 10,
  },
  proofSpinnerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 0,
  },
  proofSpinnerWrapper: {
    width: 128,
    height: 128,
    marginTop: 32,
    marginBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proofSpinnerRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  proofSpinnerRingOuter: {
    width: '100%',
    height: '100%',
    borderRadius: 64,
    borderWidth: 6,
    borderColor: '#555',
    borderTopColor: '#ffbd4a',
  },
  proofSpinnerLogo: {
    width: 50,
    height: 50,
    backgroundColor: '#ffbd4a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proofSpinnerLogoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#171717',
  },
  proofSpinnerSubtitle: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  proofSpinnerPoweredBy: {
    fontSize: 12,
    color: '#777',
    marginTop: 'auto',
    marginBottom: 12,
  },
  proofSpinnerLogoImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  retryButton: {
    backgroundColor: '#ffbd4a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#171717',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  closeButtonText: {
    color: '#aaa',
    fontSize: 14,
  },
  proofSpinnerRingNonGenerating: {
    opacity: 0.5,
  },
  proofSpinnerRingSuccess: {
    borderColor: '#27ae60',
    borderTopColor: '#27ae60',
  },
  proofSpinnerRingFailure: {
    borderColor: '#e74c3c',
    borderTopColor: '#e74c3c',
  },
  proofSpinnerLogoFailure: {
    backgroundColor: '#e74c3c',
  },
  proofSpinnerLogoSuccess: {
    backgroundColor: '#27ae60',
  },
});

export default Zkp2pProvider;
