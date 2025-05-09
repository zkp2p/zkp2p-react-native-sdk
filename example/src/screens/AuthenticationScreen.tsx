import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  useAuthentication,
  AuthenticationWebView,
} from 'zkp2p-react-native-sdk';
import type { ProviderSettings } from 'zkp2p-react-native-sdk';

interface AuthenticationScreenProps {
  onSuccess: (data: { provider: ProviderSettings }) => void;
}

export const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({
  onSuccess,
}) => {
  const [showWebView, setShowWebView] = useState(false);
  const [currentProvider, setCurrentProvider] =
    useState<ProviderSettings | null>(null);
  const {
    isAuthenticating,
    error: authError,
    startAuthentication,
    handleError,
  } = useAuthentication();

  const handleStartAuth = async () => {
    try {
      const provider = await startAuthentication('venmo', 'transfer_venmo');
      if (provider) {
        setCurrentProvider(provider);
        setShowWebView(true);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      handleError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  };

  if (showWebView && currentProvider) {
    return (
      <View style={styles.container}>
        <AuthenticationWebView
          provider={currentProvider}
          onSuccess={() => {
            onSuccess({ provider: currentProvider });
            setShowWebView(false);
          }}
          onError={(error: string) => {
            handleError(error);
            setShowWebView(false);
          }}
          onClose={() => setShowWebView(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handleStartAuth}
        disabled={isAuthenticating}
      >
        {isAuthenticating ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Start Authentication</Text>
        )}
      </TouchableOpacity>
      {authError && (
        <Text style={styles.errorText}>Error: {authError.message}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
  webView: {
    flex: 1,
  },
});
