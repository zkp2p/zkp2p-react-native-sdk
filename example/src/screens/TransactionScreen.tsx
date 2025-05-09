import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {
  useTransactionExtraction,
  useInterceptedPayload,
} from 'zkp2p-react-native-sdk';
import type {
  ExtractedTransaction,
  ProviderSettings,
  NetworkEvent,
} from 'zkp2p-react-native-sdk';

interface TransactionScreenProps {
  provider: ProviderSettings | null;
  onSelectTransaction: (
    transaction: ExtractedTransaction,
    payload: NetworkEvent
  ) => void;
}

export const TransactionScreen: React.FC<TransactionScreenProps> = ({
  provider,
  onSelectTransaction,
}) => {
  const [selectedTransaction, setSelectedTransaction] =
    useState<ExtractedTransaction | null>(null);
  const { extractTransactionsData } = useTransactionExtraction();

  // Get the intercepted network payload
  const {
    interceptedPayload,
    isCheckingStoredAuth,
    error: payloadError,
  } = useInterceptedPayload(provider);

  // Extract transactions from the response body
  const transactions = React.useMemo(() => {
    if (!provider || !interceptedPayload?.response?.body) return [];

    try {
      // Parse the response body if it's a string
      const responseBody =
        typeof interceptedPayload.response.body === 'string'
          ? JSON.parse(interceptedPayload.response.body)
          : interceptedPayload.response.body;

      // Use the provider's configuration to extract transaction data
      return extractTransactionsData(provider, responseBody);
    } catch (error) {
      console.error('Error extracting transactions:', error);
      return [];
    }
  }, [provider, interceptedPayload, extractTransactionsData]);

  const handleSelectTransaction = (transaction: ExtractedTransaction) => {
    if (!interceptedPayload) {
      console.error('No intercepted payload available');
      return;
    }
    setSelectedTransaction(transaction);
    onSelectTransaction(transaction, interceptedPayload);
  };

  // Show loading state while checking stored auth
  if (isCheckingStoredAuth) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.message}>Loading transaction data...</Text>
      </View>
    );
  }

  // Show error if there was a problem with the payload
  if (payloadError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorMessage}>
          Error loading transactions: {payloadError.message}
        </Text>
      </View>
    );
  }

  // Show message if no provider is available
  if (!provider) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No provider configuration available</Text>
      </View>
    );
  }

  // Show message if no payload is available
  if (!interceptedPayload) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No transaction data available</Text>
      </View>
    );
  }

  // Show message if no response body is available
  if (!interceptedPayload.response?.body) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No response data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transactions</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item, index) => `${item.paymentId}-${index}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.transactionItem,
              selectedTransaction?.paymentId === item.paymentId &&
                styles.selectedTransaction,
            ]}
            onPress={() => handleSelectTransaction(item)}
          >
            <Text style={styles.transactionText}>
              Recipient: {item.recipient}
            </Text>
            <Text style={styles.transactionText}>
              Amount: {item.amount} {item.currency}
            </Text>
            <Text style={styles.transactionText}>Date: {item.date}</Text>
            <Text style={styles.transactionText}>
              Payment ID: {item.paymentId}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.message}>No transactions found</Text>
        }
      />
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
  transactionItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedTransaction: {
    borderColor: '#007AFF',
    borderWidth: 2,
    backgroundColor: '#E3F2FD',
  },
  transactionText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 20,
  },
});
