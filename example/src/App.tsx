import { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import { Zkp2pProvider, useZkp2p } from 'zkp2p-react-native-sdk';
import { AuthenticationScreen } from './screens/AuthenticationScreen';
import { TransactionScreen } from './screens/TransactionScreen';
import { ProofScreen } from './screens/ProofScreen';
import type { ExtractedItemsList } from '../../src/types';

// Viem for local wallet client
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains'; // Example chain for the local client

const ZKP2P_API_KEY = process.env.ZKP2P_API_KEY;

// Create a local, ephemeral wallet client
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
const ephemeralWalletClient = createWalletClient({
  account,
  chain: base, // Using mainnet as an example for the local client
  transport: http(), // Or your preferred transport for local operations if any
});
const ephemeralChainId = base.id;

console.log(`Using ephemeral account: ${account.address}`);

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<
    'auth' | 'transactions' | 'proof'
  >('auth');
  const [selectedItem, setSelectedItem] = useState<ExtractedItemsList | null>(
    null
  );

  const {
    provider: zkp2pProviderConfig,
    isAuthenticating,
    isAuthenticated,
    interceptedPayload,
    startAuthentication,
    itemsList,
    generateProof,
    isGeneratingProof,
    claimData,
    zkp2pClient,
  } = useZkp2p();

  useEffect(() => {
    if (zkp2pClient) {
      console.log(
        'ZKP2P Client is initialized with ephemeral wallet and available via useZkp2p()'
      );
      const quote = zkp2pClient.getQuote({
        exactFiatAmount: '1000000',
        fiatCurrency: 'USD',
        user: '0x0000000000000000000000000000000000000000',
        recipient: '0x0000000000000000000000000000000000000000',
        destinationChainId: 8453,
        destinationToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        paymentPlatforms: ['venmo'],
      });
      console.log('quote', quote);
    }
  }, [zkp2pClient]);

  // Simplified useEffect for screen changes based on ZKP2P auth
  useEffect(() => {
    if (isAuthenticated) {
      setCurrentScreen('transactions');
    } else {
      // If not authenticated by ZKP2P, stay/go to auth screen for ZKP2P auth process
      // This assumes Zkp2pProvider handles its own auth flow initiation via startAuthentication
      setCurrentScreen('auth');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (itemsList.length > 0 && selectedItem) {
      setCurrentScreen('proof');
    }
  }, [itemsList, selectedItem]);

  const screen = (() => {
    // Ensure startAuthentication is available before rendering AuthenticationScreen
    if (currentScreen === 'auth') {
      return startAuthentication ? (
        <AuthenticationScreen
          isAuthenticating={isAuthenticating}
          startAuthentication={startAuthentication}
        />
      ) : (
        <View style={styles.center}>
          <Text>Initializing ZKP2P Authentication...</Text>
        </View>
      );
    }
    if (currentScreen === 'transactions') {
      return itemsList.length > 0 ? (
        <TransactionScreen
          transactions={itemsList}
          onSelectTransaction={setSelectedItem}
        />
      ) : (
        <View style={styles.center}>
          {isAuthenticated ? (
            <Text>Authenticated. No transactions found.</Text>
          ) : (
            <Text>Loading transactions...</Text>
          )}
        </View>
      );
    }
    if (currentScreen === 'proof') {
      return zkp2pProviderConfig && selectedItem && generateProof ? (
        <ProofScreen
          provider={zkp2pProviderConfig}
          interceptedPayload={interceptedPayload}
          intentHash="12345" // TODO: Placeholder, get from actual signalIntent call
          itemIndex={selectedItem.originalIndex}
          transaction={selectedItem}
          generateProof={generateProof}
          isGeneratingProof={isGeneratingProof}
          claimData={claimData}
        />
      ) : (
        <View style={styles.center}>
          <Text>Missing data for proof screen.</Text>
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Text>Loading or unknown state...</Text>
      </View>
    );
  })();

  return <SafeAreaView style={styles.container}>{screen}</SafeAreaView>;
}

export default function App() {
  return (
    <Zkp2pProvider
      walletClient={ephemeralWalletClient as any}
      apiKey={ZKP2P_API_KEY}
      chainId={ephemeralChainId}
      witnessUrl="https://witness-proxy.zkp2p.xyz"
      zkEngine="snarkjs"
      rpcTimeout={30000}
    >
      <AppContent />
    </Zkp2pProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
});
