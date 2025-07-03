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
  Easing,
  Image,
  Platform,
  Alert,
} from 'react-native';

import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@react-native-cookies/cookies';
import { JSONPath } from 'jsonpath-plus';
import type { WalletClient } from 'viem';
import Svg, { Circle } from 'react-native-svg';
import DeviceInfo from 'react-native-device-info';

import {
  type WindowRPCIncomingMsg,
  type RPCCreateClaimOptions,
} from '@zkp2p/reclaim-witness-sdk';
import { InterceptWebView } from '@zkp2p/react-native-webview-intercept';

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
import { BridgeFactory } from '../bridges/BridgeFactory';
import type { GnarkBridge } from '../bridges/GnarkBridge';
import { DEFAULT_USER_AGENT } from '../utils/constants';
import { parseReclaimProxyProof } from '../utils/reclaimProof';
import { extractMetadata, safeStringify } from './utils';

import { RPCWebView } from '../components/RPCWebView';
import Zkp2pContext from './Zkp2pContext';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Zkp2pProviderProps {
  children: ReactNode;
  witnessUrl?: string;
  prover?: 'reclaim_gnark' | 'reclaim_snarkjs';
  configBaseUrl?: string;
  rpcTimeout?: number;
  walletClient?: WalletClient;
  apiKey?: string;
  chainId?: number;
  baseApiUrl?: string;
}

// ============================================================================
// ANIMATED SVG COMPONENT
// ============================================================================

const AnimatedSvg = Animated.createAnimatedComponent(Svg as any);

const getCustomUserAgent = (providerCfg?: ProviderSettings): string => {
  if (!providerCfg?.mobile?.userAgent) {
    return DEFAULT_USER_AGENT;
  }

  return (
    Platform.select({
      ios: providerCfg.mobile.userAgent.ios,
      android: providerCfg.mobile.userAgent.android,
      default: DEFAULT_USER_AGENT,
    }) || DEFAULT_USER_AGENT
  );
};

// ============================================================================
// MEMORY HELPERS
// ============================================================================

const calculateGnarkDynamicConcurrency = async (): Promise<number> => {
  try {
    const totalMemory = await DeviceInfo.getTotalMemory();
    const usedMemory = await DeviceInfo.getUsedMemory();
    const availableMemory = totalMemory - usedMemory;

    // Calculate concurrency based on available memory
    // Assume each proof needs ~750MB
    const memoryPerProof = 750 * 1024 * 1024; // 750MB
    const suggestedConcurrency = Math.floor(
      (availableMemory * 0.5) / memoryPerProof
    ); // Use 50% of available

    // Apply limits based on total memory
    let maxConcurrency = 4;
    if (totalMemory >= 8 * 1024 * 1024 * 1024) {
      // 8GB+
      maxConcurrency = 6;
    } else if (totalMemory >= 6 * 1024 * 1024 * 1024) {
      // 6GB+
      maxConcurrency = 4;
    } else if (totalMemory >= 4 * 1024 * 1024 * 1024) {
      // 4GB+
      maxConcurrency = 3;
    } else {
      // Less than 4GB
      maxConcurrency = 2;
    }

    const finalConcurrency = Math.max(
      1,
      Math.min(suggestedConcurrency, maxConcurrency)
    );
    console.log(
      `[zkp2p] Dynamic concurrency: ${finalConcurrency} (total: ${(totalMemory / 1024 / 1024).toFixed(0)}MB, available: ${(availableMemory / 1024 / 1024).toFixed(0)}MB)`
    );
    return finalConcurrency;
  } catch (error) {
    console.log(
      '[zkp2p] Could not determine memory dynamically, using defaults:',
      error
    );
    // Fallback to 1
    return 1;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Zkp2pProvider = ({
  children,
  prover = 'reclaim_gnark',
  witnessUrl = 'https://witness-proxy.zkp2p.xyz',
  configBaseUrl = 'https://raw.githubusercontent.com/zkp2p/providers/main/',
  rpcTimeout = 30_000,
  walletClient,
  apiKey,
  chainId = 8453,
  baseApiUrl = 'https://api.zkp2p.xyz/v1',
}: Zkp2pProviderProps) => {
  // ==========================================================================
  // CLIENT INITIALIZATION
  // ==========================================================================

  const zkp2pClient = useMemo(() => {
    if (!apiKey || !walletClient) {
      return null;
    }
    const clientOptions: Zkp2pClientOptions = {
      prover,
      walletClient,
      apiKey,
      chainId,
      witnessUrl,
    };
    if (baseApiUrl) {
      clientOptions.baseApiUrl = baseApiUrl;
    }
    return new Zkp2pClient(clientOptions);
  }, [walletClient, apiKey, chainId, witnessUrl, baseApiUrl, prover]);

  // ==========================================================================
  // REFS
  // ==========================================================================

  const rpcWebViewRef = useRef<WebView>(null);
  const pending = useRef<Record<string, PendingEntry>>({});
  const spinAnimation = useRef(new Animated.Value(0)).current;

  // ==========================================================================
  // GNARK BRIDGE SETUP
  // ==========================================================================

  const gnarkBridge = useMemo<GnarkBridge | null>(() => {
    if (prover === 'reclaim_gnark') {
      return BridgeFactory.getGnarkBridge();
    }
    return null;
  }, [prover]);

  useEffect(() => {
    return () => {
      BridgeFactory.dispose();
    };
  }, []);

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  // Provider and flow state
  const [provider, setProvider] = useState<ProviderSettings | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [rpcKey, setRpcKey] = useState(0);

  // Authentication state
  const [authError, setAuthError] = useState<Error | null>(null);
  const [authWebViewProps, setAuthWebViewProps] = useState<React.ComponentProps<
    typeof InterceptWebView
  > | null>(null);

  // Data extraction state
  const [metadataList, setMetadataList] = useState<ExtractedMetadataList[]>([]);
  const [interceptedPayload, setInterceptedPayload] =
    useState<NetworkEvent | null>(null);

  // Proof generation state
  const [proofData, setProofData] = useState<ProofData[]>([]);
  const [proofError, setProofError] = useState<Error | null>(null);
  const [lastProofItemIndex, setLastProofItemIndex] = useState<number>(0);
  const [autoGenerateOptions, setAutoGenerateOptions] =
    useState<AutoGenerateProofOptions | null>(null);

  // WebView state
  const [isWebViewMinimized, setIsWebViewMinimized] = useState(false);

  // Cleanup effect for when component unmounts or prover changes
  useEffect(() => {
    return () => {
      // Cancel any active proof generations when unmounting
      if (gnarkBridge) {
        gnarkBridge.cancelAllProofs().catch((err) => {
          console.error('[zkp2p] Error cancelling proofs on unmount:', err);
        });
        gnarkBridge.cleanupMemory().catch((err) => {
          console.error('[zkp2p] Error cleaning up memory on unmount:', err);
        });
      }
    };
  }, [gnarkBridge]);

  // ==========================================================================
  // PROVIDER CONFIGURATION METHODS
  // ==========================================================================

  const _fetchProviderConfig = useCallback(
    async (platform: string, actionType: string) => {
      const res = await fetch(`${configBaseUrl}${platform}/${actionType}.json`);
      if (!res.ok) throw new Error(`Provider config HTTP ${res.status}`);
      return (await res.json()) as ProviderSettings;
    },
    [configBaseUrl]
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
      const newCfg = await _fetchProviderConfig(platform, actionType);
      setProvider(newCfg);
      return newCfg;
    },
    [_fetchProviderConfig, setProvider]
  );

  // ==========================================================================
  // AUTHENTICATION METHODS
  // ==========================================================================

  const _restoreSessionWith = useCallback(
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
          'User-Agent': getCustomUserAgent(cfg),
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

  const _handleAuthIntercept = useCallback(
    async (evt: NetworkEvent, cfg: ProviderSettings) => {
      const { metadata } = cfg;
      const primaryHit =
        evt.request.method === metadata.method &&
        new RegExp(metadata.urlRegex).test(evt.response.url);

      const fallbackHit =
        metadata.fallbackUrlRegex &&
        evt.request.method === metadata.fallbackMethod &&
        new RegExp(metadata.fallbackUrlRegex).test(evt.response.url);

      if (!primaryHit && !fallbackHit) {
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
              'User-Agent': getCustomUserAgent(cfg),
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
          console.log(
            `[zkp2p] Fallback replay response:`,
            JSON.stringify(jsonBody)
          );
        }

        const txs = extractMetadata(jsonBody, cfg);
        setMetadataList(txs);
        setInterceptedPayload(evt);

        if (
          txs.length === 0 &&
          cfg.metadata.transactionsExtraction?.transactionJsonPathListSelector
        ) {
          itemExtractionError = new Error(
            'Authentication successful, but no transactions found where items were expected.'
          );
        }

        // Close webview and update state
        setAuthWebViewProps(null);
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

  const _processInjectedScript = useCallback(
    (
      script: string | undefined,
      values: Record<string, string>,
      allowedParamNames?: string[]
    ) => {
      if (!script) return '';

      // Replace placeholders in the script
      let processedScript = script;

      // If allowedParamNames is provided, only process those parameters
      const valuesToProcess = allowedParamNames
        ? Object.entries(values).filter(([key]) =>
            allowedParamNames.includes(key)
          )
        : Object.entries(values);

      // Replace individual value placeholders
      valuesToProcess.forEach(([key, value]) => {
        // Escape the value for safe JavaScript string insertion
        const escapedValue = value
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n');
        processedScript = processedScript.replace(
          new RegExp(`{{${key}}}`, 'g'),
          escapedValue
        );
      });

      return processedScript;
    },
    []
  );

  const _setupAuthWebViewProps = useCallback(
    (cfg: ProviderSettings) => {
      return {
        source: { uri: cfg.authLink },
        urlPatterns: [
          cfg.metadata.urlRegex,
          cfg.metadata.fallbackUrlRegex,
        ].filter(Boolean) as string[],
        userAgent: getCustomUserAgent(cfg),
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
          console.error('[zkp2p] Auth webview error:', e.nativeEvent);
          setAuthError(new Error(String(e.nativeEvent?.description ?? e.type)));
          setAuthWebViewProps(null);
        },
      };
    },
    [_handleAuthIntercept, setAuthError, setAuthWebViewProps]
  );

  const _authenticateInternal = useCallback(
    async (cfg: ProviderSettings) => {
      setFlowState('authenticating');

      try {
        const reused = await _restoreSessionWith(cfg);
        if (reused) {
          setAuthWebViewProps(null);
          return;
        }
      } catch (err) {
        console.warn('[zkp2p] Stored session invalid:', err);
        setAuthError(err as Error);
      }

      const webViewProps = _setupAuthWebViewProps(cfg);
      setAuthWebViewProps(webViewProps);
    },
    [
      _restoreSessionWith,
      setFlowState,
      setAuthError,
      setAuthWebViewProps,
      _setupAuthWebViewProps,
    ]
  );

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
      }

      // Process injected script with values
      const injectedScript =
        initialAction.injectionValues && cfg.mobile?.injectedJavaScript
          ? _processInjectedScript(
              cfg.mobile.injectedJavaScript,
              initialAction.injectionValues,
              cfg.mobile.injectedJavaScriptParamNames
            )
          : '';

      console.log('[zkp2p] Action WebView injectedScript:', injectedScript);

      setAuthWebViewProps({
        source: { uri: effectiveActionUrl },
        urlPatterns: [],
        userAgent: getCustomUserAgent(cfg),
        domStorageEnabled: true,
        interceptConfig: { xhr: false, fetch: false, html: false },
        additionalCookieDomainsToInclude:
          cfg.mobile?.includeAdditionalCookieDomains ?? [],
        style: { flex: 1 },
        injectedJavaScript: injectedScript || undefined,
        onIntercept: (_evt: NetworkEvent) => {
          // Intercept should be off during action phase
        },
        onNavigationStateChange: async (navState) => {
          // Check if the current URL matches the target URL pattern
          if (
            cfg.mobile?.actionCompletedUrlRegex &&
            new RegExp(cfg.mobile?.actionCompletedUrlRegex).test(navState.url)
          ) {
            // Navigate to authentication phase
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
    [
      setFlowState,
      setAuthWebViewProps,
      setAuthError,
      _authenticateInternal,
      _processInjectedScript,
    ]
  );

  const _handleExternalAction = useCallback(
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
      }

      try {
        await Linking.openURL(effectiveActionUrl);
      } catch (linkErr) {
        console.warn('[zkp2p] Failed to open external URL:', linkErr);

        // Check if app store links are available for fallback
        const appStoreLink =
          Platform.OS === 'ios'
            ? cfg.mobile?.appStoreLink
            : cfg.mobile?.playStoreLink;

        if (appStoreLink) {
          // Show alert asking user if they want to open the app store
          Alert.alert(
            'App Not Installed',
            'Download the app from the app store to continue.',
            [
              {
                text: 'Cancel',
                onPress: () => {
                  setAuthError(
                    new Error(
                      `Failed to open action URL: ${effectiveActionUrl}`
                    )
                  );
                  setFlowState('idle');
                },
                style: 'cancel',
              },
              {
                text: 'Open App Store',
                onPress: async () => {
                  try {
                    await Linking.openURL(appStoreLink);
                    // Still set error state as the original action couldn't complete
                    setAuthError(
                      new Error(
                        'App not installed. Please install and try again.'
                      )
                    );
                    setFlowState('idle');
                  } catch (storeErr) {
                    console.error(
                      '[zkp2p] Failed to open app store:',
                      storeErr
                    );
                    setAuthError(new Error('Failed to open app store'));
                    setFlowState('idle');
                  }
                },
              },
            ],
            { cancelable: true }
          );
        } else {
          // No app store link available, just show error
          setAuthError(
            new Error(`Failed to open action URL: ${effectiveActionUrl}`)
          );
          setFlowState('idle');
        }
      }
    },
    [setFlowState, setAuthError]
  );

  const _handleInitialAction = useCallback(
    async (
      cfg: ProviderSettings,
      initialAction: NonNullable<InitiateOptions['initialAction']>
    ) => {
      const effectiveActionUrl = cfg.mobile?.actionLink;

      if (!effectiveActionUrl) return;

      const isExternalLink = cfg.mobile?.isExternalLink ?? false;

      if (isExternalLink) {
        await _handleExternalAction(effectiveActionUrl, cfg, initialAction);
      } else {
        await _handleHttpActionInWebView(
          effectiveActionUrl,
          cfg,
          initialAction
        );
      }
    },
    [_handleHttpActionInWebView, _handleExternalAction]
  );

  // ==========================================================================
  // RPC COMMUNICATION METHODS
  // ==========================================================================

  const _rpcRequest = useCallback(
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
          console.error('[Zkp2pProvider] RPC timeout exceeded:', {
            id,
            type,
            rpcTimeout: rpcTimeout / 1000 + 's',
            request: req,
          });
          delete pending.current[id];
          reject(
            new Error(
              `RPC timeout after ${rpcTimeout / 1000}s. The witness server may be unresponsive or the proof generation is taking too long.`
            )
          );
        }, rpcTimeout);

        pending.current[id] = { resolve, reject, timeout, onStep };
      });

      if (!rpcWebViewRef.current) {
        throw new Error('RPC WebView ref is null');
      }
      rpcWebViewRef.current.injectJavaScript(`
        window.postMessage(${JSON.stringify(msg)});
      `);
      return promise;
    },
    [rpcTimeout]
  );

  const _onRpcMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      // The RPCWebView now filters console logs, but we keep this as a safeguard.
      // It also filters ZK function calls, so we only expect responses here.
      const data = JSON.parse(e.nativeEvent.data);

      // Early exit for any non-attestor-core messages that might slip through
      if (!data.module || data.module !== 'attestor-core' || !data.id) {
        return;
      }

      const { id, type } = data as RPCResponse;

      if (type === 'createClaimStep') {
        if (pending.current[id]?.onStep) {
          pending.current[id].onStep(data as RPCResponse);
        }
      } else if (type === 'createClaimDone') {
        pending.current[id]?.resolve(data as RPCResponse);
        clearTimeout(pending.current[id]?.timeout);
        delete pending.current[id];
      } else if (type === 'error') {
        console.error('[zkp2p] RPC error:', data);

        // RPC errors come in format: {type: 'error', data: {message: '...', stack: '...'}}
        const errorMessage = (data as any).data?.message || 'Unknown error';
        const error = new Error(errorMessage);

        if ((data as any).data?.stack) {
          error.stack = (data as any).data.stack;
        }

        (error as any).rawData = data;

        pending.current[id]?.reject(error);
        clearTimeout(pending.current[id]?.timeout);
        delete pending.current[id];
      }
    } catch (error) {
      console.error('[zkp2p] Failed to process WebView message:', error);
    }
  }, []);

  const rpcWebViewProps = {
    ref: rpcWebViewRef,
    witnessUrl,
    onMessage: _onRpcMessage,
    gnarkBridge,
  } as const;

  // ==========================================================================
  // PROOF GENERATION METHODS
  // ==========================================================================

  const generateProof = useCallback(
    async (
      providerCfg: ProviderSettings,
      payload: NetworkEvent,
      intentHash: string,
      itemIndex: number = 0
    ) => {
      if (!payload) throw new Error('No intercepted payload available');
      if (prover !== 'reclaim_snarkjs' && prover !== 'reclaim_gnark') {
        throw new Error(`Unsupported prover: ${prover}`);
      }

      console.log('[zkp2p] Starting proof generation...');
      setFlowState('proofGenerating');
      setProofData([]);
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
        headersToSend['User-Agent'] = getCustomUserAgent(providerCfg);
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
          zkEngine: prover === 'reclaim_gnark' ? 'gnark' : 'snarkjs',
          zkOperatorMode: prover === 'reclaim_gnark' ? 'rpc' : 'default',
          zkProofConcurrency:
            prover === 'reclaim_gnark'
              ? await calculateGnarkDynamicConcurrency()
              : 1,
        };
        const res = await _rpcRequest('createClaim', rpc, (stepData) => {
          console.log('[zkp2p] Proof generation step:', stepData);
          if (stepData.step?.error) {
            console.error(
              '[zkp2p] Proof generation step error:',
              stepData.step.error
            );
          }
        });

        const proof = parseReclaimProxyProof(res.response ?? null);
        const proofDataItem: ProofData = {
          proofType: 'reclaim',
          proof: proof,
        };

        // Check if we need to generate additional proofs
        if (
          providerCfg.additionalProofs &&
          providerCfg.additionalProofs.length > 0
        ) {
          const allProofs: ProofData[] = [proofDataItem];

          for (let i = 0; i < providerCfg.additionalProofs.length; i++) {
            const additionalProofConfig = providerCfg.additionalProofs[i];
            if (!additionalProofConfig) continue;

            console.log(
              `[zkp2p] Generating additional proof ${i + 1}/${providerCfg.additionalProofs.length}...`
            );

            // Build body with param substitution
            let additionalBody = additionalProofConfig.body;
            const additionalParamValues: Record<string, string> = {};

            // Extract param values from the original response
            additionalProofConfig.paramNames.forEach((paramName, idx) => {
              const selector = additionalProofConfig.paramSelectors[idx];
              if (!selector) return;

              let responseBody = payload.response.body ?? '{}';
              if (providerCfg.metadata.preprocessRegex) {
                const m = responseBody.match(
                  new RegExp(providerCfg.metadata.preprocessRegex)
                );
                if (m?.[1]) responseBody = m[1];
              }

              if (selector.type === 'jsonPath') {
                const path = selector.value.replace(
                  '{{INDEX}}',
                  String(itemIndex)
                );
                const val = (
                  JSONPath({
                    path,
                    json: JSON.parse(responseBody),
                    resultType: 'value',
                  }) as any[]
                )[0];
                additionalParamValues[paramName] = String(val ?? '');
              } else if (selector.type === 'regex') {
                const m = responseBody.match(new RegExp(selector.value));
                if (m?.[1]) additionalParamValues[paramName] = m[1];
              }
            });

            // Replace param placeholders in body
            Object.entries(additionalParamValues).forEach(([key, value]) => {
              additionalBody = additionalBody.replace(`{{${key}}}`, value);
            });

            // Build new provider config for the additional proof
            const additionalProviderCfg: ProviderSettings = {
              ...providerCfg,
              url: additionalProofConfig.url,
              method: additionalProofConfig.method,
              body: additionalBody,
              paramNames: [],
              paramSelectors: [],
              skipRequestHeaders: additionalProofConfig.skipRequestHeaders,
              secretHeaders: additionalProofConfig.secretHeaders,
              responseMatches: additionalProofConfig.responseMatches,
              responseRedactions: additionalProofConfig.responseRedactions,
            };

            // Generate the additional proof
            const additionalProofResult = await _generateSingleProof(
              additionalProviderCfg,
              payload,
              intentHash,
              itemIndex
            );

            // Extract proof from the result
            const additionalProof = parseReclaimProxyProof(
              additionalProofResult.response ?? null
            );
            allProofs.push({
              proofType: 'reclaim',
              proof: additionalProof,
            });
          }

          setProofData(allProofs);
          setFlowState('proofGeneratedSuccess');
          return allProofs;
        } else {
          // Single proof case
          setProofData([proofDataItem]);
          setFlowState('proofGeneratedSuccess');
          return [proofDataItem];
        }
      } catch (err) {
        setFlowState('proofGeneratedFailure');
        setProofError(err as Error);
        throw err;
      } finally {
        setRpcKey((k) => k + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [_rpcRequest, witnessUrl, prover, setFlowState, setProofData, setRpcKey]
  );

  // Internal helper to generate a single proof without modifying state
  const _generateSingleProof = useCallback(
    async (
      providerCfg: ProviderSettings,
      payload: NetworkEvent,
      intentHash: string,
      itemIndex: number = 0
    ) => {
      if (!payload) throw new Error('No intercepted payload available');
      if (prover !== 'reclaim_snarkjs' && prover !== 'reclaim_gnark') {
        throw new Error(`Unsupported prover: ${prover}`);
      }

      let body = payload.response.body ?? '{}';
      if (providerCfg.metadata.preprocessRegex) {
        const m = body.match(new RegExp(providerCfg.metadata.preprocessRegex));
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
      headersToSend['User-Agent'] = getCustomUserAgent(providerCfg);

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

      const secret: { headers: Record<string, string>; cookieStr?: string } = {
        headers: {},
      };
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
        zkEngine: prover === 'reclaim_gnark' ? 'gnark' : 'snarkjs',
        zkOperatorMode: prover === 'reclaim_gnark' ? 'rpc' : 'default',
        zkProofConcurrency:
          prover === 'reclaim_gnark'
            ? await calculateGnarkDynamicConcurrency()
            : 1,
      };

      const res = await _rpcRequest('createClaim', rpc, (stepData) => {
        console.log('[zkp2p] Proof generation step:', stepData);
        if (stepData.step?.error) {
          console.error(
            '[zkp2p] Proof generation step error:',
            stepData.step.error
          );
        }
      });

      return res;
    },
    [_rpcRequest, witnessUrl, prover]
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
        options.onProofError?.(error);
        return null;
      }

      if (targetIndex >= items.length) {
        const error = new Error(
          `Item index ${targetIndex} out of range (${items.length} items available)`
        );
        options.onProofError?.(error);
        return null;
      }

      try {
        const intentHash =
          options.intentHash ||
          '0x0000000000000000000000000000000000000000000000000000000000000001';
        const result = await generateProof(
          cfg,
          payload,
          intentHash,
          targetIndex
        );

        if (flowState === 'proofGeneratedSuccess' && proofData.length > 0) {
          // For backward compatibility, pass the first proof if only one exists
          // Otherwise pass the entire array
          const proofToPass = proofData.length === 1 ? proofData[0] : proofData;
          options.onProofGenerated?.(proofToPass as any);
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

  // ==========================================================================
  // PUBLIC API METHODS
  // ==========================================================================

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
      setProofData([]);

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

      // Handle action link if it exists and skipAction is not true
      if (cfg.mobile?.actionLink && !options?.skipAction) {
        // If no initialAction provided, create default options
        const actionOptions = initialAction || { enabled: true };
        await _handleInitialAction(cfg, actionOptions);
        return cfg;
      }

      // No action link or skipAction is true - proceed directly to authentication
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

  const closeAuthWebView = () => {
    setAuthWebViewProps(null);
    setIsWebViewMinimized(false);
  };

  const minimizeAuthWebView = () => {
    setIsWebViewMinimized(!isWebViewMinimized);
  };

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Auto-generate proof effect
  useEffect(() => {
    if (
      flowState === 'authenticated' &&
      autoGenerateOptions && // If it exists, it's enabled
      proofData.length === 0 && // Only auto-generate if no proof exists yet
      provider &&
      interceptedPayload &&
      metadataList.length > 0 &&
      !authError
    ) {
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

  // Proof generation animation effect
  useEffect(() => {
    if (flowState === 'proofGenerating') {
      spinAnimation.setValue(0);
      const animation = Animated.loop(
        Animated.timing(spinAnimation, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else if (flowState === 'proofGeneratedSuccess') {
      spinAnimation.setValue(0);
      const timer = setTimeout(() => {
        setFlowState('idle');
      }, 1000);
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

  // ==========================================================================
  // RENDER
  // ==========================================================================

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
          <View style={[styles.nativeBackdrop, styles.nativeBackdropVisible]}>
            <View
              style={[
                styles.nativeWebviewContainer,
                isWebViewMinimized && styles.nativeWebviewContainerMinimized,
              ]}
            >
              <TouchableOpacity
                style={styles.nativeHeader}
                onPress={isWebViewMinimized ? minimizeAuthWebView : undefined}
                activeOpacity={isWebViewMinimized ? 0.7 : 1}
              >
                <View style={styles.headerContent}>
                  <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>
                      {(() => {
                        try {
                          const source = authWebViewProps.source as {
                            uri?: string;
                          };
                          return source?.uri
                            ? new URL(source.uri).hostname
                            : 'Loading...';
                        } catch {
                          return 'Loading...';
                        }
                      })()}
                    </Text>
                    {isWebViewMinimized && (
                      <Text style={styles.headerSubtitle}>Tap to expand</Text>
                    )}
                  </View>
                  <View style={styles.headerButtons}>
                    <TouchableOpacity
                      onPress={minimizeAuthWebView}
                      style={styles.nativeMinimizeButton}
                    >
                      <Text style={styles.nativeMinimizeText}>
                        {isWebViewMinimized ? '□' : '−'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={closeAuthWebView}
                      style={styles.nativeCloseButton}
                    >
                      <Text style={styles.nativeCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
              {!isWebViewMinimized && (
                <InterceptWebView
                  {...authWebViewProps}
                  style={styles.nativeWebview}
                />
              )}
            </View>
          </View>
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
              {/* Exit button in top right */}
              <TouchableOpacity
                style={styles.proofSpinnerExitButton}
                onPress={async () => {
                  console.log(
                    '[zkp2p] Exit button pressed, cancelling proof generation'
                  );

                  // Cancel the proof generation if using gnark
                  if (gnarkBridge && flowState === 'proofGenerating') {
                    try {
                      await gnarkBridge.cancelAllProofs();
                      console.log('[zkp2p] All proof generations cancelled');
                    } catch (err) {
                      console.error('[zkp2p] Error cancelling proofs:', err);
                    }
                  }

                  // Clean up state
                  setFlowState('idle');
                  setProofError(null);

                  // Clean up memory if using gnark
                  if (gnarkBridge) {
                    try {
                      await gnarkBridge.cleanupMemory();
                      console.log('[zkp2p] Memory cleaned up');
                    } catch (err) {
                      console.error('[zkp2p] Error cleaning up memory:', err);
                    }
                  }
                }}
              >
                <Text style={styles.proofSpinnerExitText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.proofSpinnerTitle}>
                {flowState === 'proofGeneratedSuccess'
                  ? 'Successfully Authenticated!'
                  : flowState === 'proofGeneratedFailure'
                    ? 'Authentication Failed'
                    : 'Authenticating'}
              </Text>

              <View style={styles.proofSpinnerWrapper}>
                <AnimatedSvg
                  width={128}
                  height={128}
                  style={[
                    styles.proofSpinnerRing,
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
                  viewBox="0 0 128 128"
                >
                  <Circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke={
                      flowState === 'proofGeneratedSuccess'
                        ? '#27ae60'
                        : flowState === 'proofGeneratedFailure'
                          ? '#e74c3c'
                          : '#555'
                    }
                    strokeWidth="6"
                    fill="none"
                    opacity={flowState !== 'proofGenerating' ? 0.5 : 1}
                  />
                  {/* Animated arc (colored) */}
                  {flowState === 'proofGenerating' && (
                    <Circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="#ffbd4a"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray="91.1 273.3" // ~25% of circumference
                      strokeLinecap="round"
                      transform="rotate(-90 64 64)" // Start from top
                    />
                  )}
                </AnimatedSvg>

                {/* Logo in center (always) */}
                <Image
                  source={require('../assets/logo192.png')}
                  style={styles.proofSpinnerLogoImage}
                />
              </View>

              {flowState === 'proofGeneratedFailure' ? (
                <>
                  <Text style={styles.proofSpinnerSubtitle}>
                    {proofError?.message ||
                      'An error occurred while authenticating'}
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
                      ? 'Authenticated!'
                      : 'Authenticating...'}
                  </Text>
                </>
              )}

              <Text style={styles.proofSpinnerPoweredBy}>Secured by ZKP2P</Text>
            </View>
          </View>
        </Modal>
      )}
    </Zkp2pContext.Provider>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // WebView Modal styles
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
  nativeWebviewContainerMinimized: {
    height: 'auto',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  nativeHeader: {
    height: 56,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nativeCloseButton: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    padding: 6,
  },
  nativeCloseText: {
    fontSize: 24,
    color: '#888',
  },
  nativeMinimizeButton: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    padding: 6,
    paddingHorizontal: 12,
  },
  nativeMinimizeText: {
    fontSize: 24,
    color: '#888',
    fontWeight: 'bold',
  },
  nativeWebview: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // Proof Generation Spinner styles
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

  // Button styles
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

  // Proof spinner exit button styles
  proofSpinnerExitButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  proofSpinnerExitText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
  },
});

export default Zkp2pProvider;
