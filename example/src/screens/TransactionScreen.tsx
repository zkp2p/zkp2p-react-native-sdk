import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import type { ExtractedItemsList } from '../../../src/';

interface TransactionScreenProps {
  transactions: ExtractedItemsList[];
  onSelectTransaction: (transaction: ExtractedItemsList) => void;
  onGoBack: () => void;
}

export const TransactionScreen: React.FC<TransactionScreenProps> = ({
  transactions,
  onSelectTransaction,
  onGoBack,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Transactions</Text>
      </View>
      <ScrollView style={styles.scrollView}>
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
    paddingTop: 20,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
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
  backButton: {
    padding: 10,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 17,
  },
});
