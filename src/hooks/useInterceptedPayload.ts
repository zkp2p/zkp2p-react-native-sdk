import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProviderSettings, NetworkEvent } from '../types';

export const useInterceptedPayload = (provider: ProviderSettings | null) => {
  const [interceptedPayload, setInterceptedPayload] =
    useState<NetworkEvent | null>(null);
  const [isCheckingStoredAuth, setIsCheckingStoredAuth] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getStorageKey = useCallback((providerConfig: ProviderSettings) => {
    return `intercepted_payload_${providerConfig.metadata.platform}_${providerConfig.actionType}`;
  }, []);

  const checkStoredAuth = useCallback(async () => {
    if (!provider?.metadata?.platform || !provider?.actionType) {
      setError(new Error('Invalid provider configuration'));
      setIsCheckingStoredAuth(false);
      return false;
    }

    setIsCheckingStoredAuth(true);
    setError(null);

    try {
      const storageKey = getStorageKey(provider);
      const storedPayload = await AsyncStorage.getItem(storageKey);

      if (!storedPayload) {
        setIsCheckingStoredAuth(false);
        return false;
      }

      const payload = JSON.parse(storedPayload) as NetworkEvent;

      console.log('payload', payload);

      // Validate the stored payload structure
      if (!payload.request || !payload.response) {
        throw new Error('Invalid stored payload structure');
      }

      setInterceptedPayload(payload);
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(new Error(`Error checking stored auth: ${errorMessage}`));

      // Clear invalid stored data
      try {
        await AsyncStorage.removeItem(getStorageKey(provider));
      } catch (clearErr) {
        console.error('Failed to clear invalid stored data:', clearErr);
      }

      return false;
    } finally {
      setIsCheckingStoredAuth(false);
    }
  }, [provider, getStorageKey]);

  const handleIntercept = useCallback(
    async (evt: NetworkEvent) => {
      if (!provider?.metadata?.urlRegex) {
        setError(new Error('Invalid provider configuration: missing urlRegex'));
        return false;
      }

      try {
        const urlRegex = new RegExp(provider.metadata.urlRegex);
        if (!urlRegex.test(evt?.response?.url || '')) {
          return false;
        }

        const storageKey = getStorageKey(provider);
        await AsyncStorage.setItem(storageKey, JSON.stringify(evt));
        setInterceptedPayload(evt);
        setError(null);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setError(
          new Error(`Failed to handle intercepted data: ${errorMessage}`)
        );
        return false;
      }
    },
    [provider, getStorageKey]
  );

  const clearInterceptedPayload = useCallback(async () => {
    if (!provider?.metadata?.platform || !provider?.actionType) {
      setError(new Error('Invalid provider configuration'));
      return;
    }

    try {
      const storageKey = getStorageKey(provider);
      await AsyncStorage.removeItem(storageKey);
      setInterceptedPayload(null);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(
        new Error(`Failed to clear intercepted payload: ${errorMessage}`)
      );
    }
  }, [provider, getStorageKey]);

  useEffect(() => {
    if (provider) {
      checkStoredAuth();
    } else {
      setInterceptedPayload(null);
      setIsCheckingStoredAuth(false);
      setError(null);
    }
  }, [provider, checkStoredAuth]);

  return {
    interceptedPayload,
    isCheckingStoredAuth,
    error,
    handleIntercept,
    clearInterceptedPayload,
  };
};
