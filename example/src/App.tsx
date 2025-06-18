import { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  Platform,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Zkp2pProvider, useZkp2p } from '../../src/';
import { AuthenticationScreen } from './screens/AuthenticationScreen';
import { ProofScreen } from './screens/ProofScreen';
import { ApiFunctionsScreen } from './screens/ApiFunctionsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ZKP2P_API_KEY } from '@env';

// Viem for local wallet client
import {
  createWalletClient,
  http,
  createPublicClient,
  formatEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

function AppContent({
  walletClient,
  onRequestWallet,
}: {
  walletClient: any;
  onRequestWallet: () => void;
}) {
  const [currentScreen, setCurrentScreen] = useState<
    'home' | 'api' | 'auth' | 'itemsAndProof'
  >('home');
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [usdcBalance, setUsdcBalance] = useState<string>('0');

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
        'ZKP2P Client is initialized with wallet and available via useZkp2p()'
      );
    }
  }, [zkp2pClient, flowState, isAuthenticated]);

  // Fetch ETH and USDC balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (walletClient?.account?.address && zkp2pClient) {
        try {
          const publicClient = createPublicClient({
            chain: base,
            transport: http('https://mainnet.base.org'),
          });

          // Fetch ETH balance
          const ethBal = await publicClient.getBalance({
            address: walletClient.account.address,
          });
          setEthBalance(formatEther(ethBal));

          // Fetch USDC balance using zkp2pClient
          const usdcAddress = zkp2pClient.getUsdcAddress();
          if (usdcAddress) {
            const usdcBal = await publicClient.readContract({
              address: usdcAddress,
              abi: [
                {
                  constant: true,
                  inputs: [{ name: 'account', type: 'address' }],
                  name: 'balanceOf',
                  outputs: [{ name: '', type: 'uint256' }],
                  type: 'function',
                },
              ],
              functionName: 'balanceOf',
              args: [walletClient.account.address],
            });
            // USDC has 6 decimals
            setUsdcBalance((Number(usdcBal) / 1e6).toFixed(2));
          }
        } catch (error) {
          console.error('Error fetching balances:', error);
        }
      }
    };
    fetchBalances();
  }, [walletClient, zkp2pClient]);

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
          onNavigateToApi={() => {
            if (!walletClient) {
              onRequestWallet();
            } else {
              setCurrentScreen('api');
            }
          }}
          onNavigateToAuth={() => setCurrentScreen('auth')}
        />
      );
    }

    if (currentScreen === 'api') {
      return (
        <ApiFunctionsScreen
          onGoBack={handleGoBack}
          ethBalance={ethBalance}
          usdcBalance={usdcBalance}
        />
      );
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
  const [privateKey, setPrivateKey] = useState<string>('');
  const [walletClient, setWalletClient] = useState<any>(null);
  const [showWalletSetup, setShowWalletSetup] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSetupWallet = () => {
    try {
      setError('');
      // Validate private key format
      if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
        setError(
          'Invalid private key format. Must be 0x followed by 64 hex characters.'
        );
        return;
      }

      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const client = createWalletClient({
        account,
        chain: base,
        transport: http('https://mainnet.base.org'),
      });

      setWalletClient(client);
      setShowWalletSetup(false);
      console.log(`Using account: ${account.address}`);
    } catch (err) {
      setError('Failed to create wallet. Please check your private key.');
      console.error(err);
    }
  };

  if (showWalletSetup) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.setupContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowWalletSetup(false)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.setupTitle}>Connect Wallet</Text>
          <Text style={styles.setupSubtitle}>
            Enter your private key to access API functions
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="0x..."
              value={privateKey}
              onChangeText={setPrivateKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.setupButton,
              !privateKey && styles.setupButtonDisabled,
            ]}
            onPress={handleSetupWallet}
            disabled={!privateKey}
          >
            <Text style={styles.setupButtonText}>Connect Wallet</Text>
          </TouchableOpacity>

          <Text style={styles.warningText}>
            ⚠️ Never share your private key. This is for testing purposes only.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <Zkp2pProvider
      walletClient={walletClient}
      apiKey={walletClient ? ZKP2P_API_KEY : undefined}
      chainId={8453}
      witnessUrl="https://witness-proxy.zkp2p.xyz"
      rpcTimeout={60000}
      prover="reclaim_gnark"
    >
      <AppContent
        walletClient={walletClient}
        onRequestWallet={() => setShowWalletSetup(true)}
      />
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
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 15,
    zIndex: 1,
    padding: 10,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  setupTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  setupSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  setupButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginTop: 10,
  },
  setupButtonDisabled: {
    backgroundColor: '#ccc',
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  warningText: {
    color: '#ff9500',
    fontSize: 14,
    marginTop: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modeSection: {
    width: '100%',
    marginBottom: 20,
  },
  modeSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modeSectionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  proofOnlyButton: {
    backgroundColor: '#34C759',
  },
});
