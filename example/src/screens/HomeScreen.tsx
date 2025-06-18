import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface HomeScreenProps {
  onNavigateToApi: () => void;
  onNavigateToAuth: () => void;
}

export function HomeScreen({
  onNavigateToApi,
  onNavigateToAuth,
}: HomeScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ZKP2P SDK Demo</Text>
      <Text style={styles.subtitle}>Get started below</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.apiButton]}
          onPress={onNavigateToApi}
        >
          <Text style={styles.buttonText}>API Functions</Text>
          <Text style={styles.buttonSubtext}>
            Create deposits and signal intents
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.authButton]}
          onPress={onNavigateToAuth}
        >
          <Text style={styles.buttonText}>Authentication</Text>
          <Text style={styles.buttonSubtext}>
            Authenticate and generate proofs
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 20,
  },
  button: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  apiButton: {
    backgroundColor: '#007AFF',
  },
  authButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  buttonSubtext: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  proofOnlyNote: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
});
