import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import type {
  ProviderSettings,
  ExtractedMetadataList,
  ProofData,
  FlowState,
  NetworkEvent,
} from '../../../src';

// Helper function to handle BigInt serialization for JSON.stringify
function serializeBigInt(_key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

/* ───────────────────────── Props ───────────────────────── */
interface CombinedScreenProps {
  items: ExtractedMetadataList[];
  onGoBack: () => void;
  generateProof: (
    providerCfg: ProviderSettings,
    payload: NetworkEvent,
    intentHash: string,
    itemIndex?: number
  ) => Promise<any>;
  proofData: ProofData | null;
  flowState: FlowState;
  authError: Error | null;
  zkp2pProviderConfig: ProviderSettings | null;
  interceptedPayload: NetworkEvent | null;
}

/* ───────────────────────── Component ───────────────────── */
export const ProofScreen: React.FC<CombinedScreenProps> = ({
  items,
  onGoBack,
  generateProof,
  proofData,
  flowState,
  authError,
  zkp2pProviderConfig,
  interceptedPayload,
}) => {
  const [selectedItemForProof, setSelectedItemForProof] =
    useState<ExtractedMetadataList | null>(null);

  const handleItemPress = async (item: ExtractedMetadataList) => {
    if (!zkp2pProviderConfig || !generateProof || !interceptedPayload) {
      console.error(
        '[ProofScreen] Missing provider config or generateProof function via props.'
      );
      return;
    }
    setSelectedItemForProof(item);
    try {
      const intentHash =
        '0x0000000000000000000000000000000000000000000000000000000000000001';
      await generateProof(
        zkp2pProviderConfig,
        interceptedPayload,
        intentHash,
        item.originalIndex
      );
    } catch (err) {
      console.error('[ProofScreen] Error calling generateProof:', err);
    }
  };

  const renderTransactionItem = ({ item }: { item: ExtractedMetadataList }) => (
    <TouchableOpacity
      style={styles.transactionItem}
      onPress={() => handleItemPress(item)}
    >
      {Object.entries(item).map(([key, value]) => {
        if (key === 'hidden' || key === 'originalIndex') return null;
        return (
          <Text key={key} style={styles.transactionDetailText}>
            <Text style={styles.transactionDetailKey}>{key}: </Text>
            {String(value)}
          </Text>
        );
      })}
      {selectedItemForProof &&
        selectedItemForProof.originalIndex === item.originalIndex &&
        flowState === 'proofGenerating' && (
          <ActivityIndicator
            size="small"
            color="#007AFF"
            style={styles.activityIndicatorInItem}
          />
        )}
    </TouchableOpacity>
  );

  const isGeneratingProofForSelectedItem =
    selectedItemForProof && flowState === 'proofGenerating';

  const proofSuccessfullyGeneratedForSelectedItem =
    selectedItemForProof && flowState === 'proofGeneratedSuccess' && proofData;

  const proofFailedForSelectedItem =
    selectedItemForProof && flowState === 'proofGeneratedFailure' && authError;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Transactions & Proof</Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderTransactionItem}
        keyExtractor={(item, index) =>
          item.originalIndex?.toString() || index.toString()
        }
        ListHeaderComponent={
          <Text style={styles.listTitle}>
            Select an Item to Generate Proof:
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.emptyListText}>No transactions found.</Text>
        }
        contentContainerStyle={styles.listContentContainer}
      />

      {selectedItemForProof && (
        <View style={styles.proofSectionContainer}>
          <Text style={styles.proofSectionTitle}>
            Proof Status for Item (Index: {selectedItemForProof.originalIndex})
          </Text>
          {isGeneratingProofForSelectedItem && (
            <View style={styles.card}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.statusText}>
                Generating proof, please wait...
              </Text>
            </View>
          )}
          {proofSuccessfullyGeneratedForSelectedItem && (
            <View style={styles.card}>
              <Text style={styles.resultTitle}>
                Proof Generated Successfully!
              </Text>
              <ScrollView style={styles.resultScrollView}>
                <Text style={styles.resultText}>
                  {JSON.stringify(proofData?.proof, serializeBigInt, 2)}
                </Text>
              </ScrollView>
            </View>
          )}
          {proofFailedForSelectedItem && (
            <View style={styles.card}>
              <Text style={styles.errorTitle}>Proof Generation Failed</Text>
              <Text style={styles.errorText}>{authError?.message}</Text>
            </View>
          )}
          {authError &&
            !proofFailedForSelectedItem &&
            flowState !== 'proofGenerating' &&
            flowState !== 'proofGeneratedSuccess' && (
              <View style={[styles.card, styles.generalErrorCard]}>
                <Text style={styles.errorTitle}>An Error Occurred</Text>
                <Text style={styles.errorText}>{authError.message}</Text>
              </View>
            )}
        </View>
      )}
    </View>
  );
};

/* ───────────────────────── Styles ──────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    marginLeft: -30,
  },
  backButton: { padding: 10, zIndex: 1 },
  backButtonText: { color: '#007AFF', fontSize: 17 },

  listContentContainer: { paddingHorizontal: 10, paddingBottom: 10 },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 15,
    marginLeft: 5,
    color: '#333',
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: 'grey',
  },

  transactionItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionDetailText: { fontSize: 14, color: '#333', marginBottom: 3 },
  transactionDetailKey: { fontWeight: '500' },

  activityIndicatorInItem: {
    marginTop: 5,
  },

  proofSectionContainer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
    backgroundColor: '#f9f9f9',
  },
  proofSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#222',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
    elevation: 1.5,
  },
  statusText: { marginTop: 10, fontSize: 15, color: '#555' },
  resultTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    fontSize: 16,
    color: 'green',
  },
  resultScrollView: { maxHeight: 150, width: '100%' },
  resultText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#333',
  },

  errorTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 16,
    color: '#D8000C',
  },
  errorText: { fontSize: 14, color: '#D8000C', textAlign: 'center' },
  generalErrorCard: { backgroundColor: '#FFEBEE' },
});
