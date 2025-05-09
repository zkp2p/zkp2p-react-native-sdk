import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useZkp2p } from 'zkp2p-react-native-sdk';
import type {
  ExtractedTransaction,
  ProviderSettings,
} from 'zkp2p-react-native-sdk';
import { RPCWebView } from 'zkp2p-react-native-sdk';

interface ProofScreenProps {
  provider: ProviderSettings;
  transaction: ExtractedTransaction;
  interceptedPayload: any;
  intentHash: string;
}

export const ProofScreen: React.FC<ProofScreenProps> = ({
  provider,
  transaction,
  interceptedPayload,
  intentHash,
}) => {
  const {
    rpcWebViewRef,
    isGeneratingProof,
    claimData,
    isWebViewReady,
    handleRPCMessage,
    handleWebViewLoad,
    handleWebViewError,
    generateProof,
  } = useZkp2p();

  const handleGenerateProof = async () => {
    if (!isWebViewReady) {
      console.log('Waiting for WebView to be ready...');
      return;
    }

    try {
      const proof = await generateProof(
        provider,
        transaction,
        interceptedPayload,
        intentHash
      );
      console.log('Generated proof:', proof);
    } catch (error) {
      console.error('Proof generation error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>Proof Generation</Text>

        <View style={styles.transactionInfo}>
          <Text style={styles.infoTitle}>Selected Transaction:</Text>
          <Text style={styles.infoText}>
            Recipient: {transaction.recipient}
          </Text>
          <Text style={styles.infoText}>
            Amount: {transaction.amount} {transaction.currency}
          </Text>
          <Text style={styles.infoText}>Date: {transaction.date}</Text>
          <Text style={styles.infoText}>
            Payment ID: {transaction.paymentId}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (isGeneratingProof || !isWebViewReady) && styles.buttonDisabled,
          ]}
          onPress={handleGenerateProof}
          disabled={isGeneratingProof || !isWebViewReady}
        >
          {isGeneratingProof ? (
            <ActivityIndicator color="white" />
          ) : !isWebViewReady ? (
            <Text style={styles.buttonText}>Initializing...</Text>
          ) : (
            <Text style={styles.buttonText}>Generate Proof</Text>
          )}
        </TouchableOpacity>

        {claimData && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>
              Proof Generated Successfully!
            </Text>
            <Text style={styles.resultText}>
              Claim Data: {JSON.stringify(claimData, null, 2)}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Hidden RPC WebView */}
      <RPCWebView
        ref={rpcWebViewRef}
        onMessage={handleRPCMessage}
        onLoad={handleWebViewLoad}
        onError={handleWebViewError}
      />
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
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  transactionInfo: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#007AFF',
  },
  resultText: {
    fontSize: 14,
    color: '#333',
  },
});
