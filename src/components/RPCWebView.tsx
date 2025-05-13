import { forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface RPCWebViewProps {
  onMessage: (event: any) => void;
  onLoad?: () => void;
  onError?: (error: any) => void;
  witnessUrl: string;
}

export const RPCWebView = forwardRef<WebView, RPCWebViewProps>(
  ({ onMessage, onLoad, onError, witnessUrl }, ref) => {
    return (
      <View style={styles.container}>
        <WebView
          ref={ref}
          source={{ uri: `${witnessUrl}/browser-rpc` }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          onMessage={onMessage}
          onLoad={onLoad}
          onError={onError}
          injectedJavaScriptBeforeContentLoaded={`
          const consoleLog = (level, log) => 
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ 'type': 'console', level, 'data': log })
          )
          console = {
            log: (...log) => consoleLog('log', log),
            debug: (...log) => consoleLog('debug', log),
            info: (...log) => consoleLog('info', log),
            warn: (...log) => consoleLog('warn', log),
            error: (...log) => consoleLog('error', log),
            assert: (...log) => {},
          };
    
          window.onunhandledrejection = (err) => {
            console.error(\`unhandled reject: $\{err.reason} $\{err.reason.stack} \`)
          }
        `}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    height: 0,
    overflow: 'hidden',
  },
});
