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
            console.log(
              `[WebView Console.${data.level}]`,
              ...(data.data || [])
            );
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
                  const witness = args[0];
                  console.log('[RPCWebView] Calling native gnarkBridge.prove');
                  const proofResult = await gnarkBridge.prove(witness);
                  result = {
                    proof: proofResult.proof,
                    publicSignals: proofResult.publicSignals,
                  };
                  break;
                }

                case 'groth16Verify': {
                  const publicSignals = args[0];
                  const proof = args[1];
                  const algorithm = 'aes-256-ctr';
                  console.log('[RPCWebView] Calling native gnarkBridge.verify');
                  const isValid = await gnarkBridge.verify(
                    algorithm,
                    proof,
                    publicSignals
                  );
                  result = isValid;
                  break;
                }

                default:
                  throw new Error(`Unsupported ZK function for gnark: ${fn}`);
              }

              const response = {
                id: data.id,
                module: data.module || 'attestor-core',
                type: 'executeZkFunctionV3',
                isResponse: true,
                response: result,
              };

              console.log(
                '[RPCWebView] Sending ZK success response:',
                response
              );
              internalWebViewRef.current?.postMessage(JSON.stringify(response));
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
              internalWebViewRef.current?.postMessage(
                JSON.stringify(errorResponse)
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
                if (parsed.isResponse && (parsed.type === 'executeZkFunctionV3' || parsed.type === 'error')) {
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
          onLoad={onLoad}
          onError={onError}
          injectedJavaScript={injectedJavaScript}
          webviewDebuggingEnabled={__DEV__}
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
