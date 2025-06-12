import { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, View, Text, Platform } from 'react-native';
import { Zkp2pProvider, useZkp2p } from '../../src/';
import { AuthenticationScreen } from './screens/AuthenticationScreen';
import { ProofScreen } from './screens/ProofScreen';
import { ApiFunctionsScreen } from './screens/ApiFunctionsScreen';
import { HomeScreen } from './screens/HomeScreen';

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
    'home' | 'api' | 'auth' | 'itemsAndProof'
  >('home');

  const {
    provider: zkp2pProviderConfig,
    flowState,
    metadataList,
    initiate,
    generateProof,
    proofData,
    zkp2pClient,
    authError,
    interceptedPayload,
  } = useZkp2p();

  const isAuthenticating =
    flowState === 'authenticating' || flowState === 'actionStarted';
  const isAuthenticated = flowState === 'authenticated';

  useEffect(() => {
    if (zkp2pClient) {
      console.log(
        'ZKP2P Client is initialized with ephemeral wallet and available via useZkp2p()'
      );
    }
  }, [zkp2pClient, flowState, isAuthenticated]);

  useEffect(() => {
    if (flowState === 'authenticated') {
      setCurrentScreen('itemsAndProof');
      console.log(
        '[AppContent] Navigating to itemsAndProof. metadataList:',
        JSON.stringify(metadataList, null, 2)
      );
    }
  }, [flowState, metadataList]);

  const handleGoBack = () => {
    if (
      currentScreen === 'itemsAndProof' ||
      currentScreen === 'api' ||
      currentScreen === 'auth'
    ) {
      setCurrentScreen('home');
    }
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
      return initiate ? (
        <AuthenticationScreen
          isAuthenticating={isAuthenticating}
          startAuthentication={initiate}
          onGoBack={handleGoBack}
        />
      ) : (
        <View style={styles.center}>
          <Text>Initializing ZKP2P Authentication...</Text>
        </View>
      );
    }

    if (currentScreen === 'itemsAndProof') {
      // Allow rendering if we have metadata OR proof data, regardless of flowState
      const canRenderProofScreen =
        (metadataList && metadataList.length > 0) || proofData;

      return canRenderProofScreen && generateProof ? (
        <ProofScreen
          items={metadataList || []}
          onGoBack={handleGoBack}
          generateProof={generateProof}
          proofData={proofData}
          flowState={flowState}
          authError={authError}
          zkp2pProviderConfig={zkp2pProviderConfig}
          interceptedPayload={interceptedPayload}
        />
      ) : (
        <View style={styles.center}>
          <Text>No data available</Text>
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
      witnessUrl="https://witness-proxy-dev.zkp2p.xyz"
      configBaseUrl={
        Platform.OS === 'android'
          ? 'http://10.0.2.2:8080/' // Android emulator host
          : 'http://localhost:8080/' // iOS/web
      }
      rpcTimeout={60000}
      prover="reclaim_gnark"
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
  subText: { fontSize: 12, color: 'grey', marginTop: 5 },
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
