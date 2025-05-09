import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProviderSettings } from '../types';
import { DEFAULT_PROVIDERS_BASE_URL } from '../utils/constants';

interface AuthenticationState {
  isAuthenticating: boolean;
  provider: ProviderSettings | null;
}

export const useAuthentication = () => {
  const [state, setState] = useState<AuthenticationState>({
    isAuthenticating: false,
    provider: null,
  });

  const fetchProviderConfig = useCallback(
    async (platform: string, actionType: string): Promise<ProviderSettings> => {
      try {
        const storedBaseUrl = await AsyncStorage.getItem('PROVIDERS_BASE_URL');
        const baseUrl = storedBaseUrl || DEFAULT_PROVIDERS_BASE_URL;
        const configUrl = `${baseUrl}${platform}/${actionType}.json`;

        const response = await fetch(configUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch provider config: ${response.status}`
          );
        }

        const providerConfig = await response.json();
        return providerConfig;
      } catch (error) {
        console.error('Error fetching provider config:', error);
        throw error;
      }
    },
    []
  );

  const startAuthentication = useCallback(
    async (platform: string, actionType: string) => {
      setState((prev) => ({ ...prev, isAuthenticating: true, error: null }));

      try {
        // Fetch provider configuration
        const provider = await fetchProviderConfig(platform, actionType);
        setState((prev) => ({
          ...prev,
          provider,
          isAuthenticating: true, // Keep authenticating true for WebView
        }));
        return provider;
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({
          ...prev,
          isAuthenticating: false,
          error: errorObj,
        }));
        throw errorObj;
      }
    },
    [fetchProviderConfig]
  );

  const handleError = useCallback((error: string) => {
    setState((prev) => ({
      ...prev,
      isAuthenticating: false,
      error: new Error(error),
    }));
  }, []);

  const handleSuccess = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isAuthenticating: false,
      error: null,
    }));
  }, []);

  return {
    ...state,
    startAuthentication,
    handleError,
    handleSuccess,
  };
};
