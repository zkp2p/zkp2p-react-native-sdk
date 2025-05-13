import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useZkp2p } from 'zkp2p-react-native-sdk';
import type {
  ProviderSettings,
  NetworkEvent,
  ExtractedItemsList,
} from 'zkp2p-react-native-sdk';

/* ───────────────────────── Props ───────────────────────── */
interface Props {
  provider: ProviderSettings;
  interceptedPayload: NetworkEvent | null;
  intentHash: string;
  itemIndex: number;
  transaction: ExtractedItemsList;

  /* injected from <App /> */
  generateProof: ReturnType<typeof useZkp2p>['generateProof'];
  isGeneratingProof: boolean;
  claimData: any;
}

/* ───────────────────────── Component ───────────────────── */
export const ProofScreen: React.FC<Props> = ({
  provider,
  interceptedPayload,
  intentHash,
  itemIndex,
  transaction,
  generateProof,
  isGeneratingProof,
  claimData,
}) => {
  const handleGenerate = () => {
    if (
      !provider ||
      !intentHash ||
      !interceptedPayload ||
      itemIndex === null ||
      !generateProof
    ) {
      console.error('Missing required data');
      return;
    }
    console.log('provider', provider);
    console.log('interceptedPayload', interceptedPayload);
    console.log('intentHash', intentHash);
    console.log('itemIndex', itemIndex);
    console.log('generateProof', generateProof);
    generateProof(provider, interceptedPayload, intentHash, itemIndex).catch(
      console.error
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Proof Generation</Text>

        <View style={styles.card}>
          {Object.entries(transaction).map(
            ([key, value]) =>
              key !== 'hidden' &&
              key !== 'originalIndex' && (
                <Text key={key} style={styles.row}>
                  <Text style={styles.label}>{key}: </Text>
                  <Text style={styles.value}>{String(value)}</Text>
                </Text>
              )
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, isGeneratingProof && styles.disabled]}
          onPress={handleGenerate}
          disabled={isGeneratingProof}
        >
          {isGeneratingProof ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Generate Proof</Text>
          )}
        </TouchableOpacity>

        {claimData && (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>Claim Data</Text>
            <Text style={styles.resultText}>
              {JSON.stringify(claimData, null, 2)}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

/* ───────────────────────── Styles ──────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
  },
  row: { marginBottom: 4 },
  label: { fontWeight: '600', color: '#333', textTransform: 'capitalize' },
  value: { color: '#333' },

  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: { backgroundColor: '#bbb' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  result: {
    marginTop: 24,
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
  },
  resultTitle: { fontWeight: '600', marginBottom: 8 },
  resultText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
