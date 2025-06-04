import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type {
  ProviderSettings,
  InitiateOptions as SDKInitiateOptions,
} from '../../../src/';

interface Props {
  isAuthenticating: boolean;
  startAuthentication: (
    platform: string,
    actionType: string,
    options?: SDKInitiateOptions
  ) => Promise<ProviderSettings>;
  onGoBack: () => void;
}

export const AuthenticationScreen: React.FC<Props> = ({
  isAuthenticating,
  startAuthentication,
  onGoBack,
}) => {
  const [activePlatform, setActivePlatform] = useState<string | null>(null);

  const handleSelect = async (platform: string, action: string) => {
    setActivePlatform(platform);
    try {
      const currentButtonOptions = {
        text: 'I have completed payment',
        position: 'bottom_center' as const,
        style: {
          backgroundColor: '#FF3F3E',
          color: '#FFFFFF',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '700' as '700',
          padding: '16px 32px',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
        },
      };

      if (platform === 'mercadopago') {
        currentButtonOptions.style = {
          ...currentButtonOptions.style,
          backgroundColor: '#FFE600',
          color: '#2D3277',
        };
      }

      const authOptions: SDKInitiateOptions = {
        initialAction: {
          buttonOptions: currentButtonOptions,
        },
        authOverrides: {},
      };

      if (startAuthentication) {
        await startAuthentication(platform, action, authOptions);
      }
    } finally {
      setActivePlatform(null);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Select Platform</Text>

      <TouchableOpacity
        style={[
          styles.button,
          isAuthenticating && activePlatform === 'venmo' && styles.disabled,
        ]}
        disabled={isAuthenticating && activePlatform === 'venmo'}
        onPress={() => handleSelect('venmo', 'transfer_venmo')}
      >
        {isAuthenticating && activePlatform === 'venmo' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Venmo</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          isAuthenticating && activePlatform === 'revolut' && styles.disabled,
        ]}
        disabled={isAuthenticating && activePlatform === 'revolut'}
        onPress={() => handleSelect('revolut', 'transfer_revolut')}
      >
        {isAuthenticating && activePlatform === 'revolut' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Revolut</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          isAuthenticating && activePlatform === 'chase' && styles.disabled,
        ]}
        disabled={isAuthenticating && activePlatform === 'chase'}
        onPress={() => handleSelect('chase', 'transfer_zelle')}
      >
        {isAuthenticating && activePlatform === 'chase' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Chase (Zelle)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          isAuthenticating &&
            activePlatform === 'bankofamerica' &&
            styles.disabled,
        ]}
        disabled={isAuthenticating && activePlatform === 'bankofamerica'}
        onPress={() => handleSelect('bankofamerica', 'transfer_zelle')}
      >
        {isAuthenticating && activePlatform === 'bankofamerica' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Bank of America (Zelle)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          isAuthenticating && activePlatform === 'citi' && styles.disabled,
        ]}
        disabled={isAuthenticating && activePlatform === 'citi'}
        onPress={() => handleSelect('citi', 'transfer_zelle')}
      >
        {isAuthenticating && activePlatform === 'citi' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Citibank (Zelle)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          isAuthenticating &&
            activePlatform === 'mercadopago' &&
            styles.disabled,
        ]}
        disabled={isAuthenticating && activePlatform === 'mercadopago'}
        onPress={() => handleSelect('mercadopago', 'transfer_mercado_pago')}
      >
        {isAuthenticating && activePlatform === 'mercadopago' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Mercado Pago</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          isAuthenticating && activePlatform === 'wise' && styles.disabled,
        ]}
        disabled={isAuthenticating && activePlatform === 'wise'}
        onPress={() => handleSelect('wise', 'transfer_wise')}
      >
        {isAuthenticating && activePlatform === 'wise' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Wise</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          isAuthenticating && activePlatform === 'cashapp' && styles.disabled,
        ]}
        disabled={isAuthenticating && activePlatform === 'cashapp'}
        onPress={() => handleSelect('cashapp', 'transfer_cashapp')}
      >
        {isAuthenticating && activePlatform === 'cashapp' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Cash App</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabled: { backgroundColor: '#9bb8ff' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 18,
  },
});
