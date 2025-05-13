import { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import { useZkp2p, Zkp2pProvider } from 'zkp2p-react-native-sdk';
import { AuthenticationScreen } from './screens/AuthenticationScreen';
import { TransactionScreen } from './screens/TransactionScreen';
import { ProofScreen } from './screens/ProofScreen';
import CookieManager from '@react-native-cookies/cookies';
import type { ExtractedItemsList } from '../../src/types';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<
    'auth' | 'transactions' | 'proof'
  >('auth');
  const [selectedItem, setSelectedItem] = useState<ExtractedItemsList | null>(
    null
  );
  const {
    /* auth */
    provider,
    isAuthenticating,
    isAuthenticated,
    interceptedPayload,
    startAuthentication,

    /* tx */
    itemsList,

    /* proof */
    generateProof,
    isGeneratingProof,
    claimData,
  } = useZkp2p();

  console.log('App state:', {
    isAuthenticated,
    interceptedPayload,
    currentScreen,
    isAuthenticating,
    provider,
    hasProvider: !!provider,
    hasItemsList: itemsList.length > 0,
  });

  console.log('selectedItem:', selectedItem);

  /* ─── route guards ─── */
  useEffect(() => {
    console.log('isAuthenticated changed:', isAuthenticated);
    if (isAuthenticated) setCurrentScreen('transactions');
  }, [isAuthenticated]);
  useEffect(() => {
    if (itemsList.length > 0 && selectedItem) setCurrentScreen('proof');
  }, [itemsList, selectedItem]);

  console.log('cookies:', CookieManager.getAll(true));

  /* ─── screen renderer ─── */
  const screen = (() => {
    switch (currentScreen) {
      case 'auth':
        return startAuthentication ? (
          <AuthenticationScreen
            isAuthenticating={isAuthenticating}
            startAuthentication={startAuthentication}
          />
        ) : (
          <View style={styles.center}>
            <Text>Loading provider...</Text>
          </View>
        );

      case 'transactions':
        return itemsList.length > 0 ? (
          <TransactionScreen
            transactions={itemsList}
            onSelectTransaction={setSelectedItem}
          />
        ) : (
          <View style={styles.center}>
            <Text>No provider.</Text>
          </View>
        );

      case 'proof':
        return provider && selectedItem && generateProof ? (
          <ProofScreen
            provider={provider}
            interceptedPayload={interceptedPayload}
            intentHash="12345" // TODO: get from signalIntent
            itemIndex={selectedItem.originalIndex}
            transaction={selectedItem}
            generateProof={generateProof}
            isGeneratingProof={isGeneratingProof}
            claimData={claimData}
          />
        ) : (
          <View style={styles.center}>
            <Text>Missing data.</Text>
          </View>
        );
    }
  })();

  return <SafeAreaView style={styles.container}>{screen}</SafeAreaView>;
}

export default function App() {
  return (
    <Zkp2pProvider
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
