import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { AuthenticationScreen } from './screens/AuthenticationScreen';
import { TransactionScreen } from './screens/TransactionScreen';
import { ProofScreen } from './screens/ProofScreen';
import type {
  ExtractedTransaction,
  ProviderSettings,
  NetworkEvent,
} from 'zkp2p-react-native-sdk';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<
    'auth' | 'transactions' | 'proof'
  >('auth');
  const [provider, setProvider] = useState<ProviderSettings | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<ExtractedTransaction | null>(null);
  const [interceptedPayload, setInterceptedPayload] =
    useState<NetworkEvent | null>(null);

  const handleAuthSuccess = (data: { provider: ProviderSettings }) => {
    console.log('Auth success data:', data);
    setProvider(data.provider);
    setCurrentScreen('transactions');
  };

  const handleTransactionSelect = (
    transaction: ExtractedTransaction,
    payload: NetworkEvent
  ) => {
    setSelectedTransaction(transaction);
    setInterceptedPayload(payload);
    setCurrentScreen('proof');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'auth':
        return <AuthenticationScreen onSuccess={handleAuthSuccess} />;
      case 'transactions':
        return (
          <TransactionScreen
            provider={provider}
            onSelectTransaction={handleTransactionSelect}
          />
        );
      case 'proof':
        return (
          <ProofScreen
            provider={provider!}
            transaction={selectedTransaction!}
            interceptedPayload={interceptedPayload!}
            intentHash={'01234'} // TODO: temporary
          />
        );
      default:
        return null;
    }
  };

  return <SafeAreaView style={styles.container}>{renderScreen()}</SafeAreaView>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
