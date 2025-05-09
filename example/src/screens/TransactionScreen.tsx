import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import type { ExtractedTransaction } from 'zkp2p-react-native-sdk';

interface TransactionScreenProps {
  transactions: ExtractedTransaction[];
  onSelectTransaction: (transaction: ExtractedTransaction) => void;
}

export const TransactionScreen: React.FC<TransactionScreenProps> = ({
  transactions,
  onSelectTransaction,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Transactions</Text>
        {transactions.map((transaction, index) => (
          <TouchableOpacity
            key={index}
            style={styles.transactionItem}
            onPress={() => onSelectTransaction(transaction)}
          >
            <Text style={styles.transactionText}>
              {transaction.amount} {transaction.currency}
            </Text>
            <Text style={styles.transactionText}>{transaction.recipient}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  transactionItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionText: {
    fontSize: 16,
    color: '#333',
  },
});
