import { useCallback } from 'react';
import { JSONPath } from 'jsonpath-plus';
import type { ProviderSettings, ExtractedTransaction } from '../types';

export const useTransactionExtraction = () => {
  const extractTransactionsData = useCallback(
    (
      provider: ProviderSettings,
      jsonResponseBody: any
    ): ExtractedTransaction[] => {
      if (!provider.metadata.transactionsExtraction) return [];

      const { transactionJsonPathListSelector, transactionJsonPathSelectors } =
        provider.metadata.transactionsExtraction;

      try {
        const list = JSONPath({
          path: transactionJsonPathListSelector,
          json: jsonResponseBody,
          resultType: 'value',
        }) as any[];

        return list[0]
          .map((transfer: any, originalIndex: number) => {
            const recipientResult = (
              JSONPath({
                path: transactionJsonPathSelectors.recipient || '',
                json: transfer,
                resultType: 'value',
              }) as any[]
            )[0];
            const amountResult = (
              JSONPath({
                path: transactionJsonPathSelectors.amount || '',
                json: transfer,
                resultType: 'value',
              }) as any[]
            )[0];
            const dateResult = (
              JSONPath({
                path: transactionJsonPathSelectors.date || '',
                json: transfer,
                resultType: 'value',
              }) as any[]
            )[0];
            const paymentIdResult = (
              JSONPath({
                path: transactionJsonPathSelectors.paymentId || '',
                json: transfer,
                resultType: 'value',
              }) as any[]
            )[0];
            const currencyResult = (
              JSONPath({
                path: transactionJsonPathSelectors.currency || '',
                json: transfer,
                resultType: 'value',
              }) as any[]
            )[0];

            return {
              recipient: recipientResult || 'N/A',
              amount: amountResult || 'N/A',
              date: dateResult || 'N/A',
              paymentId: paymentIdResult || 'N/A',
              currency: currencyResult || 'N/A',
              hidden:
                !recipientResult ||
                !amountResult ||
                !dateResult ||
                !paymentIdResult,
              originalIndex,
            };
          })
          .filter((transaction: ExtractedTransaction) => !transaction.hidden);
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
