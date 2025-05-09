import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProviderSettings, NetworkEvent } from '../types';

export const useInterceptedPayload = (provider: ProviderSettings | null) => {
  const [interceptedPayload, setInterceptedPayload] =
    useState<NetworkEvent | null>(null);
  const [isCheckingStoredAuth, setIsCheckingStoredAuth] = useState(false);

  const clearInterceptedPayload = useCallback(async () => {
    if (provider) {
      await AsyncStorage.removeItem(
        `intercepted_payload_${provider.metadata.platform}_${provider.actionType}`
      );
      setInterceptedPayload(null);
    }
  }, [provider]);

  const checkStoredAuth = useCallback(async () => {
    if (!provider) {
      setIsCheckingStoredAuth(false);
      return false;
    }

    setIsCheckingStoredAuth(true);
    try {
      const storedPayload = await AsyncStorage.getItem(
        `intercepted_payload_${provider.metadata.platform}_${provider.actionType}`
      );

      if (!storedPayload) {
        console.log('No stored payload found');
        setIsCheckingStoredAuth(false);
        return false;
      }

      const payload = JSON.parse(storedPayload);
      console.log('Checking stored auth with payload:', payload);

      // Try to fetch with stored credentials
      const response = await fetch(payload.request.url, {
        method: payload.request.method,
        headers: payload.request.cookie
          ? {
              ...payload.request.headers,
              Cookie: payload.request.cookie,
            }
          : payload.request.headers,
        body: payload.request.body,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch with stored payload: ${response.status}`
        );
      }

      // If we get here, the stored auth is still valid
      setInterceptedPayload(payload);
      setIsCheckingStoredAuth(false);
      return true;
    } catch (error) {
      console.log('Auth expired', error);
      // Clear stored payload if it's invalid
      await clearInterceptedPayload();
      setIsCheckingStoredAuth(false);
      return false;
    }
  }, [provider, clearInterceptedPayload]);

  const handleIntercept = useCallback(
    async (evt: NetworkEvent) => {
      if (!provider) return;

      if (
        new RegExp(provider.metadata.urlRegex).test(evt?.response.url || '')
      ) {
        try {
          // Store the intercepted payload with all required NetworkEvent properties
          const payloadToStore: NetworkEvent = {
            type: evt.type,
            api: evt.api,
            request: {
              url: evt.request.url,
              method: evt.request.method,
              headers: evt.request.headers,
              cookie: evt.request.cookie,
              body: evt.request.body,
            },
            response: {
              url: evt.response.url,
              status: evt.response.status,
              headers: evt.response.headers,
              body: evt.response.body,
            },
          };

          await AsyncStorage.setItem(
            `intercepted_payload_${provider.metadata.platform}_${provider.actionType}`,
            JSON.stringify(payloadToStore)
          );

          setInterceptedPayload(payloadToStore);
        } catch (error) {
          console.error('Failed to store intercepted payload:', error);
        }
      }
    },
    [provider]
  );

  // Check stored auth on mount
  useEffect(() => {
    if (provider) {
      checkStoredAuth();
    } else {
      setIsCheckingStoredAuth(false);
    }
  }, [provider, checkStoredAuth]);

  return {
    interceptedPayload,
    isCheckingStoredAuth,
    handleIntercept,
    clearInterceptedPayload,
    checkStoredAuth,
  };
};
