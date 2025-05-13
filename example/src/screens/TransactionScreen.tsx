import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import type { ExtractedItemsList } from 'zkp2p-react-native-sdk';

interface TransactionScreenProps {
  transactions: ExtractedItemsList[];
  onSelectTransaction: (transaction: ExtractedItemsList) => void;
}

export const TransactionScreen: React.FC<TransactionScreenProps> = ({
  transactions,
  onSelectTransaction,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Transactions</Text>
        {transactions.map((transaction, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.transactionItem}
            onPress={() => onSelectTransaction(transaction)}
          >
            {Object.keys(transaction).map((key, innerIdx) => (
              <Text key={innerIdx} style={styles.transactionText}>
                {key}: {transaction[key]}
              </Text>
            ))}
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
