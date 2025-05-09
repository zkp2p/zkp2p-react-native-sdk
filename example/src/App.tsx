import { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import { useZkp2p } from 'zkp2p-react-native-sdk';
import { AuthenticationScreen } from './screens/AuthenticationScreen';
import { TransactionScreen } from './screens/TransactionScreen';
import { ProofScreen } from './screens/ProofScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<
    'auth' | 'transactions' | 'proof'
  >('auth');

  const {
    provider,
    startAuthentication,
    handleError,
    isAuthenticating,
    error,
    isAuthenticated,
    checkStoredAuth,
    transactions,
    selectedTransaction,
    handleTransactionSelect,
    interceptedPayload,
  } = useZkp2p();

  // Check stored auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const hasValidAuth = await checkStoredAuth();
        if (hasValidAuth) {
          setCurrentScreen('transactions');
        } else {
          setCurrentScreen('auth');
        }
      } catch (err) {
        console.error('Error checking auth:', err);
        setCurrentScreen('auth');
      }
    };
    checkAuth();
  }, [checkStoredAuth]);

  // Handle screen changes based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      setCurrentScreen('transactions');
    }
  }, [isAuthenticated]);

  // Handle transaction selection
  useEffect(() => {
    if (selectedTransaction) {
      console.log('Transaction selected, navigating to proof screen');
      setCurrentScreen('proof');
    }
  }, [selectedTransaction]);

  const handleAuthSuccess = async (platform: string, actionType: string) => {
    try {
      await startAuthentication(platform, actionType);
    } catch (err) {
      console.error('Authentication error:', err);
      handleError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'auth':
        return (
          <AuthenticationScreen
            onSuccess={handleAuthSuccess}
            onError={handleError}
            isAuthenticating={isAuthenticating}
            error={error}
            provider={provider}
          />
        );
      case 'transactions':
        if (!provider) {
          return (
            <View style={styles.container}>
              <Text>No provider selected</Text>
            </View>
          );
        }
        return (
          <TransactionScreen
            transactions={transactions}
            onSelectTransaction={handleTransactionSelect}
          />
        );
      case 'proof':
        if (!interceptedPayload || !selectedTransaction || !provider) {
          return (
            <View style={styles.container}>
              <Text>
                No intercepted payload or selected transaction available
              </Text>
            </View>
          );
        }
        return (
          <ProofScreen
            provider={provider}
            transaction={selectedTransaction}
            interceptedPayload={interceptedPayload}
            intentHash="12354"
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
    backgroundColor: '#fff',
  },
});
