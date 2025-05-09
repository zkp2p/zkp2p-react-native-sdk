import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AuthenticationWebView } from 'zkp2p-react-native-sdk';
import type { ProviderSettings } from 'zkp2p-react-native-sdk';

interface AuthenticationScreenProps {
  onSuccess: (platform: string, actionType: string) => Promise<void>;
  onError: (error: string) => void;
  isAuthenticating: boolean;
  provider: ProviderSettings | null;
}

export const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({
  onSuccess,
  onError,
  isAuthenticating,
  provider,
}) => {
  const handlePlatformSelect = async (platform: string, actionType: string) => {
    try {
      await onSuccess(platform, actionType);
    } catch (error) {
      console.error('Platform selection error:', error);
      onError(
        error instanceof Error ? error.message : 'Failed to select platform'
      );
    }
  };

  const handleWebViewSuccess = async () => {
    if (provider) {
      try {
        await onSuccess(provider.metadata.platform, provider.actionType);
      } catch (error) {
        console.error('WebView success error:', error);
        onError(
          error instanceof Error ? error.message : 'Authentication failed'
        );
      }
    }
  };

  if (isAuthenticating && provider) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Authenticating with {provider.metadata.platform}
        </Text>
        <AuthenticationWebView
          provider={provider}
          onSuccess={handleWebViewSuccess}
          onError={onError}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Platform</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, isAuthenticating && styles.buttonDisabled]}
          onPress={() => handlePlatformSelect('venmo', 'transfer_venmo')}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Venmo</Text>
          )}
        </TouchableOpacity>
      </View>
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
  buttonContainer: {
    gap: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
});
