import { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Zkp2pProvider, useZkp2p } from 'zkp2p-react-native-sdk';
import { AuthenticationScreen } from './screens/AuthenticationScreen';
import { TransactionScreen } from './screens/TransactionScreen';
import { ProofScreen } from './screens/ProofScreen';
import type { ExtractedItemsList } from '../../src/types';

// Wallet connection via WalletConnect
import EthereumProvider from '@walletconnect/ethereum-provider';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { base } from 'viem/chains';

const ZKP2P_API_KEY = 'your-api-key';

const WALLETCONNECT_PROJECT_ID = 'your-wc-project-id';

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
        'ZKP2P Client is initialized with connected wallet and available via useZkp2p()'
      );
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
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const connectWallet = async () => {
    try {
      const provider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        showQrModal: true,
        chains: [base.id],
      });
      await provider.enable();
      const wc = createWalletClient({
        account: provider.accounts[0] as `0x${string}`,
        chain: base,
        transport: custom(provider),
      });
      setWalletClient(wc);
    } catch (err) {
      console.error('Wallet connection failed', err);
    }
  };

  if (!walletClient) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <TouchableOpacity style={styles.button} onPress={connectWallet}>
          <Text style={styles.buttonText}>Connect Wallet</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <Zkp2pProvider
      walletClient={walletClient}
      apiKey={ZKP2P_API_KEY}
      chainId={base.id}
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
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
});
