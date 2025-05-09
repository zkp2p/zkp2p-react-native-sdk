import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Text,
} from 'react-native';
import type { ViewStyle, TextStyle } from 'react-native';
import { InterceptWebView } from '@zkp2p/react-native-webview-intercept';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProviderSettings } from '../types';

const DEFAULT_USER_AGENT = Platform.select({
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15.0 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
  default: '',
});

interface NetworkEvent {
  type: 'network';
  api: 'fetch' | 'xhr' | 'html';
  request: {
    url: string;
    method?: string;
    headers: Record<string, string>;
    body?: string | null;
    cookie: string | null;
  };
  response: {
    url: string;
    status: number;
    headers: Record<string, string>;
    body: string | null;
  };
}

interface AuthenticationWebViewProps {
  provider: ProviderSettings;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  containerStyle?: ViewStyle;
  webViewStyle?: ViewStyle;
  loadingContainerStyle?: ViewStyle;
  loadingTextStyle?: TextStyle;
  loadingIndicatorColor?: string;
  loadingText?: string;
  redirectCountdown?: number;
}

export const AuthenticationWebView: React.FC<AuthenticationWebViewProps> = ({
  provider,
  onSuccess,
  onError,
  onClose,
  containerStyle,
  webViewStyle,
  loadingContainerStyle,
  loadingTextStyle,
  loadingIndicatorColor = '#FFFFFF',
  loadingText = 'Redirecting in {countdown} seconds...',
  redirectCountdown = 3,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [countdown, setCountdown] = useState(redirectCountdown);

  const handleRedirect = () => {
    setIsRedirecting(true);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRedirecting(false);
          setCountdown(redirectCountdown);
          onClose?.();
          return redirectCountdown;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleIntercept = async (evt: NetworkEvent) => {
    if (new RegExp(provider.metadata.urlRegex).test(evt?.response.url || '')) {
      try {
        await AsyncStorage.setItem(
          `intercepted_payload_${provider.metadata.platform}_${provider.actionType}`,
          JSON.stringify(evt)
        );

        handleRedirect();
        onSuccess?.(evt);
      } catch (error) {
        console.error('Failed to handle intercepted data:', error);
        onError?.(error instanceof Error ? error.message : 'Unknown error');
      }
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.webViewContainer, webViewStyle]}>
        <InterceptWebView
          ref={webViewRef}
          source={{ uri: provider.authLink }}
          urlPatterns={[provider.metadata.urlRegex]}
          interceptConfig={{
            xhr: true,
            fetch: true,
            html: true,
            maxBodyBytes: 1024 * 1024 * 10,
          }}
          userAgent={DEFAULT_USER_AGENT}
          onNavigationStateChange={(navState) => {
            console.log('Navigation state:', navState);
          }}
          onLoadEnd={() => console.log('Page loaded')}
          onError={(syntheticEvent) => {
            console.error('WebView error:', syntheticEvent.nativeEvent);
            onError?.(syntheticEvent.nativeEvent.description);
          }}
          onIntercept={handleIntercept}
          style={styles.webView}
        />

        {isRedirecting && (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.spinnerOverlay,
              loadingContainerStyle,
            ]}
          >
            <ActivityIndicator size="large" color={loadingIndicatorColor} />
            <Text style={[styles.spinnerText, loadingTextStyle]}>
              {loadingText.replace('{countdown}', countdown.toString())}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  spinnerOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
