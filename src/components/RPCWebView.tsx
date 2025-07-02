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
            if (data.level === 'error' || data.level === 50) {
              console.error(`[WebView Console Error]`, ...(data.data || []));
            }
            return;
          }

          if (data.type === 'executeZkFunctionV3' && gnarkBridge) {
            console.log('[RPCWebView] Received executeZkFunctionV3 request:', {
              id: data.id,
              module: data.module,
              fn: data.request?.fn,
            });
            try {
              const { fn, args } = data.request;
              let result: any;

              switch (fn) {
                case 'groth16Prove': {
                  let witness = args[0];
                  let cipherParsed = 'aes-256-ctr'; // default

                  // Extract cipher from witness for algorithm selection
                  try {
                    let witnessBase64;
                    if (
                      typeof witness === 'object' &&
                      witness.type === 'uint8array' &&
                      witness.value
                    ) {
                      witnessBase64 = witness.value;
                    } else if (typeof witness === 'string') {
                      witnessBase64 = witness;
                    } else {
                      throw new Error('Invalid witness format');
                    }

                    const decodedWitness = atob(witnessBase64);
                    const witnessObj = JSON.parse(decodedWitness);
                    cipherParsed = witnessObj.cipher || 'aes-256-ctr';
                  } catch (e) {
                    console.warn(
                      '[RPCWebView] Failed to extract cipher from witness:',
                      e
                    );
                  }

                  let witnessForGnark: string;
                  if (typeof witness === 'string') {
                    witnessForGnark = witness;
                  } else {
                    witnessForGnark = JSON.stringify(witness);
                  }

                  console.log(
                    '[RPCWebView] Passing witness to gnark with algorithm:',
                    cipherParsed
                  );

                  const proofResult = await gnarkBridge.prove(
                    witnessForGnark,
                    cipherParsed
                  );

                  console.log('[RPCWebView] Proof generated successfully');

                  // Ensure we have valid strings
                  if (!proofResult.proof || !proofResult.publicSignals) {
                    throw new Error(
                      'Invalid proof result: missing proof or publicSignals'
                    );
                  }

                  result = {
                    proof: {
                      type: 'uint8array',
                      value: proofResult.proof,
                    },
                    publicSignals: {
                      type: 'uint8array',
                      value: proofResult.publicSignals,
                    },
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

              const responseForServer = {
                id: data.id,
                module: data.module || 'attestor-core',
                type: 'executeZkFunctionV3Done',
                isResponse: true,
                response: result,
                ...(result.requestId ? { requestId: result.requestId } : {}),
              };

              if (
                !responseForServer.response.proof?.value ||
                !responseForServer.response.publicSignals?.value
              ) {
                throw new Error(
                  'Invalid response structure: missing proof or publicSignals value'
                );
              }

              console.log('[RPCWebView] Sending response to server');

              try {
                // Send response as a STRING to match witness server expectations
                const responseString = JSON.stringify(responseForServer);
                internalWebViewRef.current?.injectJavaScript(`
                  (function() {
                    try {
                      const responseStr = ${JSON.stringify(responseString)};
                      console.log('[RPCWebView] Sending response string via postMessage');
                      window.postMessage(responseStr, '*');
                    } catch (err) {
                      console.error('[RPCWebView] Error sending response:', err);
                    }
                  })();
                `);
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
                error: {
                  data: {
                    message:
                      error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                  },
                },
              };
              const errorString = JSON.stringify(errorResponse);
              internalWebViewRef.current?.injectJavaScript(`
                (function() {
                  try {
                    const errorStr = ${JSON.stringify(errorString)};
                    console.log('[RPCWebView] Sending error response string via postMessage');
                    window.postMessage(errorStr, '*');
                  } catch (err) {
                    console.error('[RPCWebView] Error sending error response:', err);
                  }
                })();
              `);
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
              reactNativePostMessage(messageStr);
              return;
            }
          } catch(e) {
            // ignore
          }
          
          return originalWindowPostMessage.apply(window, arguments);
        };
        
        true;
      })();
    `;

    return (
      <View style={styles.container}>
        {/* @ts-ignore - React 19 type incompatibility with react-native-webview */}
        <WebView
          ref={internalWebViewRef}
          source={{ uri: `${witnessUrl}/browser-rpc` }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          onMessage={handleMessage}
          onLoad={onLoad}
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
