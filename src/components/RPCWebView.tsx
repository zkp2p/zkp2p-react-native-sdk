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
                    // Witness is in RPC wrapper format
                  }

                  // Decode the witness from the wrapper
                  const decodedWitness = atob(witness.value);
                  const witnessObj = JSON.parse(decodedWitness);
                  const cipherParsed = witnessObj.cipher;

                  const proofResult = await gnarkBridge.prove(
                    decodedWitness,
                    cipherParsed
                  );

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

              try {
                const jsonString = JSON.stringify(responseForServer);
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
