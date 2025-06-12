import { forwardRef, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { GnarkBridge } from '../bridges/GnarkBridge';

interface RPCWebViewProps {
  onMessage: (event: WebViewMessageEvent) => void;
  onLoad?: () => void;
  onError?: (error: any) => void;
  witnessUrl: string;
  gnarkBridge?: GnarkBridge | null;
}

export const RPCWebView = forwardRef<WebView, RPCWebViewProps>(
  ({ onMessage, onLoad, onError, witnessUrl, gnarkBridge }, ref) => {
    const internalWebViewRef = useRef<WebView>(null);

    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(internalWebViewRef.current);
        } else {
          ref.current = internalWebViewRef.current;
        }
      }
    }, [ref]);

    const handleMessage = useCallback(
      async (event: WebViewMessageEvent) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);

          if (data.type === 'console') {
            // Enhanced logging for console errors
            if (data.level === 'error' || data.level === 50) {
              console.error(
                `[WebView Console.error]`,
                ...(data.data || []),
                '\nFull data:',
                JSON.stringify(data, null, 2)
              );
            } else {
              console.log(
                `[WebView Console.${data.level}]`,
                ...(data.data || [])
              );
            }
            return;
          }

          if (data.type === 'executeZkFunctionV3' && gnarkBridge) {
            console.log(
              '[RPCWebView] Intercepted ZK function request for gnark:',
              data
            );

            try {
              const { fn, args } = data.request;
              let result: any;

              switch (fn) {
                case 'groth16Prove': {
                  let witness = args[0];

                  // Check if witness is in RPC wrapper format and decode it
                  if (
                    typeof witness === 'object' &&
                    witness.type === 'uint8array' &&
                    witness.value
                  ) {
                    console.log('[RPCWebView] Decoding RPC wrapper format...');
                    // Decode base64 to get the actual witness JSON
                    console.log('[RPCWebView] Decoding base64...');
                    console.log('[RPCWebView] Witness:', witness);
                  }

                  console.log('[RPCWebView] Calling native gnarkBridge.prove');
                  console.log('[RPCWebView] Witness wrapper:', witness);

                  // Decode the witness from the wrapper
                  const decodedWitness = atob(witness.value);
                  const witnessObj = JSON.parse(decodedWitness);
                  const cipherParsed = witnessObj.cipher;

                  console.log('[RPCWebView] Decoded witness:', decodedWitness);
                  console.log('[RPCWebView] Cipher:', cipherParsed);

                  const proofResult = await gnarkBridge.prove(
                    decodedWitness, // Pass the decoded JSON string
                    cipherParsed
                  );
                  console.log('[RPCWebView] Proof result:', proofResult);

                  result = {
                    proof: proofResult.proof,
                    publicSignals: proofResult.publicSignals,
                  };
                  break;
                }

                default:
                  throw new Error(
                    `Unsupported ZK function for gnark: ${fn}. Only groth16Prove is supported.`
                  );
              }

              // Ensure we have all required fields
              if (!result || !result.proof || !result.publicSignals) {
                throw new Error(
                  `Invalid proof result: ${JSON.stringify(result)}`
                );
              }

              // Log the exact proof that server will receive
              console.log('[RPCWebView] EXACT PROOF STRING:');
              console.log(result.proof);
              console.log('[RPCWebView] EXACT PUBLIC SIGNALS STRING:');
              console.log(result.publicSignals);

              // Convert base64 strings to the expected format
              const responseForServer = {
                id: data.id || '',
                module: data.module || 'attestor-core',
                type: 'executeZkFunctionV3Done',
                isResponse: true,
                response: {
                  proof: result.proof,
                  publicSignals: result.publicSignals,
                },
              };

              console.log(
                '[RPCWebView] Response for server:',
                responseForServer
              );
              // Additional logging to debug the format
              console.log('[RPCWebView] Base64 validation:', {
                proofIsValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(result.proof),
                publicSignalsIsValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(
                  result.publicSignals
                ),
                proofModulo4: result.proof.length % 4,
                publicSignalsModulo4: result.publicSignals.length % 4,
              });

              try {
                const jsonString = JSON.stringify(responseForServer);
                console.log(
                  '[RPCWebView] JSON string length:',
                  jsonString.length
                );
                console.log(
                  '[RPCWebView] JSON preview:',
                  jsonString.substring(0, 200) + '...'
                );

                internalWebViewRef.current?.injectJavaScript(
                  `window.postMessage(${jsonString});`
                );
              } catch (stringifyError) {
                console.error(
                  '[RPCWebView] JSON.stringify error:',
                  stringifyError
                );
                throw stringifyError;
              }
            } catch (error) {
              console.error(
                '[RPCWebView] ZK function execution failed:',
                error
              );
              const errorResponse = {
                id: data.id,
                module: data.module || 'attestor-core',
                type: 'error',
                isResponse: true,
                data: {
                  message:
                    error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                },
              };
              internalWebViewRef.current?.injectJavaScript(
                `window.postMessage(${JSON.stringify(errorResponse)});`
              );
            }

            return;
          }

          onMessage(event);
        } catch (e) {
          onMessage(event);
        }
      },
      [gnarkBridge, onMessage]
    );

    const injectedJavaScript = `
      (function() {
        const consoleLog = (level, log) => 
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ 'type': 'console', 'level': level, 'data': log })
          );
        
        console = {
          log: (...log) => consoleLog('log', log),
          debug: (...log) => consoleLog('debug', log),
          info: (...log) => consoleLog('info', log),
          warn: (...log) => consoleLog('warn', log),
          error: (...log) => consoleLog('error', log),
          assert: (...log) => {},
        };
        
        window.onunhandledrejection = (err) => {
          console.error(\`unhandled promise rejection: \${err.reason}\`, err.reason?.stack);
        };

        const reactNativePostMessage = window.ReactNativeWebView.postMessage;
        
        const originalWindowPostMessage = window.postMessage;
        window.postMessage = function(message, targetOrigin, transfer) {
          let messageStr = '';
          try {
            if (typeof message === 'object') {
              messageStr = JSON.stringify(message);
            } else {
              messageStr = message;
            }

            const parsed = JSON.parse(messageStr);
            if (parsed.type === 'executeZkFunctionV3' && !parsed.isResponse) {
              console.log('[WebView Interceptor] Forwarding ZK request to RN:', parsed);
              reactNativePostMessage(messageStr);
              return;
            }
          } catch(e) {
            // ignore
          }
          
          return originalWindowPostMessage.apply(window, arguments);
        };
        
        window.addEventListener('message', function(event) {
          if (event.source !== window) {
            try {
              if(event.data && typeof event.data === 'string') {
                const parsed = JSON.parse(event.data);
                if (parsed.isResponse && (parsed.type === 'executeZkFunctionV3Done' || parsed.type === 'error')) {
                  console.log('[WebView Interceptor] Received ZK response from RN:', parsed);
                  window.dispatchEvent(new MessageEvent('message', {
                    data: parsed,
                    origin: event.origin,
                    source: window.self,
                  }));
                }
              }
            } catch(e) {
               // ignore
            }
          }
        });
        
        true;
      })();
    `;

    return (
      <View style={styles.container}>
        <WebView
          ref={internalWebViewRef}
          source={{ uri: `${witnessUrl}/browser-rpc` }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          onMessage={handleMessage}
          onLoad={() => {
            console.log(
              '[RPCWebView] WebView loaded successfully from:',
              `${witnessUrl}/browser-rpc`
            );
            onLoad?.();
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('[RPCWebView] WebView error:', nativeEvent);
            onError?.(nativeEvent);
          }}
          injectedJavaScript={injectedJavaScript}
        />
      </View>
    );
  }
);

RPCWebView.displayName = 'RPCWebView';

const styles = StyleSheet.create({
  container: {
    height: 0,
    width: 0,
    overflow: 'hidden',
  },
});
