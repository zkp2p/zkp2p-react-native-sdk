import { useCallback } from 'react';
import { JSONPath } from 'jsonpath-plus';
import type {
  ProviderSettings,
  ExtractedTransaction,
  NetworkEvent,
} from '../types';

export const useTransactionExtraction = () => {
  const extractTransactionsData = useCallback(
    async (
      provider: ProviderSettings,
      interceptedPayload: NetworkEvent
    ): Promise<ExtractedTransaction[]> => {
      if (!provider.metadata.transactionsExtraction) return [];

      try {
        // Check if this is a main request or fallback request
        const isMainRequest =
          interceptedPayload.request.method === provider.metadata.method &&
          new RegExp(provider.metadata.urlRegex).test(
            interceptedPayload.request.url
          );

        const isFallbackRequest =
          interceptedPayload.request.method ===
            provider.metadata.fallbackMethod &&
          new RegExp(provider.metadata.fallbackUrlRegex).test(
            interceptedPayload.request.url
          );

        if (!isMainRequest && !isFallbackRequest) return [];

        let responseBody: string;

        if (isMainRequest) {
          // Handle preprocess regex if exists
          responseBody = interceptedPayload.response.body || '{}';
          if (provider.metadata.preprocessRegex) {
            const preprocessRegex = new RegExp(
              provider.metadata.preprocessRegex
            );
            const preprocessedResponseBody =
              responseBody.match(preprocessRegex);
            if (preprocessedResponseBody && preprocessedResponseBody[1]) {
              responseBody = preprocessedResponseBody[1];
            }
          }
        } else if (isFallbackRequest) {
          // For fallback requests, replay the request
          const options = {
            method: provider.method,
            headers: Object.entries(interceptedPayload.request.headers).reduce(
              (acc: { [key: string]: string }, [name, value]) => {
                if (
                  typeof name !== 'undefined' &&
                  typeof value !== 'undefined'
                ) {
                  acc[name] = value;
                }
                return acc;
              },
              {}
            ),
          } as any;

          if (
            provider.method !== 'GET' &&
            provider.method !== 'HEAD' &&
            provider.body
          ) {
            options.body = provider.body;
          }

          const actualUrl = new URL(provider.url);
          actualUrl.searchParams.append('replay_request', '1');

          const resp = await fetch(actualUrl.toString(), options);
          responseBody = await resp.text();
        } else {
          return [];
        }

        const {
          transactionJsonPathListSelector,
          transactionJsonPathSelectors,
        } = provider.metadata.transactionsExtraction;

        const list = JSONPath({
          path: transactionJsonPathListSelector,
          json: JSON.parse(responseBody),
          resultType: 'value',
        }) as any[];

        if (!list || !list[0]) return [];

        return list[0].map((transfer: any, originalIndex: number) => {
          // Create an object to store all extracted fields
          const extractedFields: { [key: string]: any } = {};

          // Extract each field defined in the template
          Object.entries(transactionJsonPathSelectors).forEach(
            ([fieldName, jsonPath]) => {
              const result = JSONPath({
                path: jsonPath,
                json: transfer,
                resultType: 'value',
              })[0];
              extractedFields[fieldName] = result;
            }
          );

          // Hide row if any field is undefined or null
          const hidden = Object.values(extractedFields).some(
            (value) => value === undefined || value === null
          );

          return {
            ...extractedFields,
            hidden,
            originalIndex,
          } as ExtractedTransaction;
        });
      } catch (error) {
        console.error('Error extracting transactions:', error);
        return [];
      }
    },
    []
  );

  return {
    extractTransactionsData,
  };
};
