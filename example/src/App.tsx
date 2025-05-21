import { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import { Zkp2pProvider, useZkp2p } from 'zkp2p-react-native-sdk';
import { AuthenticationScreen } from './screens/AuthenticationScreen';
import { TransactionScreen } from './screens/TransactionScreen';
import { ProofScreen } from './screens/ProofScreen';
import { ApiFunctionsScreen } from './screens/ApiFunctionsScreen';
import { HomeScreen } from './screens/HomeScreen';
import type { ExtractedItemsList } from '../../src/types';

// Viem for local wallet client
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';

const ZKP2P_API_KEY = 'your-api-key';

const privateKey =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat 0
const account = privateKeyToAccount(privateKey);
const ephemeralWalletClient = createWalletClient({
  account,
  chain: hardhat,
  transport: http(),
});

console.log(`Using ephemeral account: ${account.address}`);

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<
    'home' | 'api' | 'auth' | 'transactions' | 'proof'
  >('home');
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
    }
  }, [zkp2pClient]);

  // Simplified useEffect for screen changes based on ZKP2P auth
  useEffect(() => {
    if (isAuthenticated) {
      setCurrentScreen('transactions');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (itemsList.length > 0 && selectedItem) {
      setCurrentScreen('proof');
    }
  }, [itemsList, selectedItem]);

  const handleGoBack = () => {
    if (currentScreen === 'proof') {
      setCurrentScreen('transactions');
      setSelectedItem(null); // Clear selected item when going back from proof
    } else if (
      currentScreen === 'transactions' ||
      currentScreen === 'api' ||
      currentScreen === 'auth'
    ) {
      setCurrentScreen('home');
    }
    // Potentially add more specific back navigation if needed, e.g., auth -> home
  };

  const screen = (() => {
    if (currentScreen === 'home') {
      return (
        <HomeScreen
          onNavigateToApi={() => setCurrentScreen('api')}
          onNavigateToAuth={() => setCurrentScreen('auth')}
        />
      );
    }

    if (currentScreen === 'api') {
      return <ApiFunctionsScreen onGoBack={handleGoBack} />;
    }

    if (currentScreen === 'auth') {
      return startAuthentication ? (
        <AuthenticationScreen
          isAuthenticating={isAuthenticating}
          startAuthentication={startAuthentication}
          onGoBack={handleGoBack}
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
          onGoBack={handleGoBack}
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
          onGoBack={handleGoBack}
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
      chainId={31337}
      witnessUrl="https://witness-proxy.zkp2p.xyz"
      baseApiUrl="http://localhost:8080/v1"
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
  backButton: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 1,
    padding: 10,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
