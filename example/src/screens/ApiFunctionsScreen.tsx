import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useZkp2p, DEPLOYED_ADDRESSES, currencyInfo } from '../../../src/';
import type { Hash } from 'viem';
import {
  type WithdrawDepositParams,
  type CancelIntentParams,
  type EscrowDepositView,
  type EscrowIntentView,
} from '../../../src/types';
import { BigNumber } from 'ethers';

interface ApiFunctionsScreenProps {
  onGoBack: () => void;
  ethBalance: string;
  usdcBalance: string;
}

export function ApiFunctionsScreen({
  onGoBack,
  ethBalance,
  usdcBalance,
}: ApiFunctionsScreenProps) {
  const { zkp2pClient } = useZkp2p();
  const [isDepositLoading, setIsDepositLoading] = useState(false);
  const [isIntentLoading, setIsIntentLoading] = useState(false);
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
  const [isCancelLoading, setIsCancelLoading] = useState(false);
  const [depositHash, setDepositHash] = useState<string | null>(null);
  const [intentTransactionHash, setIntentTransactionHash] = useState<
    string | null
  >(null);
  const [deposits, setDeposits] = useState<EscrowDepositView[]>([]);
  const [intent, setIntent] = useState<EscrowIntentView | null>(null);
  const [venmoUsername, setVenmoUsername] = useState<string | null>(null);

  // Find the first active deposit that is for Venmo with at least 1 USDC available
  const firstActiveDeposit = deposits.find((d) => {
    // Check if deposit is accepting intents
    if (!d.deposit.acceptingIntents) return false;

    // Check if deposit has at least 1 USDC (1000000 in 6 decimals)
    if (d.availableLiquidity.lt(BigNumber.from(1000000))) return false;

    // Check if any verifier is for Venmo
    const venmoAddress = zkp2pClient?.getDeployedAddresses().venmo;
    return d.verifiers.some(
      (v) => v.verifier.toLowerCase() === venmoAddress?.toLowerCase()
    );
  });

  // Get payee details hash from the first Venmo verifier
  const getPayeeDetailsHash = () => {
    if (!firstActiveDeposit) return null;
    const venmoAddress = zkp2pClient?.getDeployedAddresses().venmo;
    const venmoVerifier = firstActiveDeposit.verifiers.find(
      (v) => v.verifier.toLowerCase() === venmoAddress?.toLowerCase()
    );
    return venmoVerifier?.verificationData.payeeDetails || null;
  };

  const fetchDeposits = useCallback(async () => {
    if (!zkp2pClient?.walletClient?.account) return;
    try {
      console.log(
        'Fetching deposits for address:',
        zkp2pClient.walletClient.account.address
      );
      const result = await zkp2pClient.getAccountDeposits(
        zkp2pClient.walletClient.account.address
      );
      setDeposits(result || []);
    } catch (error) {
      console.error('Error fetching deposits:', error);
      setDeposits([]);
    }
  }, [zkp2pClient]);

  const fetchIntents = useCallback(async () => {
    if (!zkp2pClient?.walletClient?.account) return;
    try {
      const result = await zkp2pClient.getAccountIntent(
        zkp2pClient.walletClient.account.address
      );
      setIntent(result);

      // If we have an intent, fetch the payee details to get venmo username
      if (result && zkp2pClient) {
        try {
          const payeeDetailsResult = await zkp2pClient.getPayeeDetails({
            hashedOnchainId:
              result.deposit.verifiers.find(
                (v) =>
                  v.verifier.toLowerCase() ===
                  zkp2pClient.getDeployedAddresses().venmo?.toLowerCase()
              )?.verificationData.payeeDetails || '',
            platform: 'venmo',
          });
          if (payeeDetailsResult?.responseObject.depositData.venmoUsername) {
            setVenmoUsername(
              payeeDetailsResult.responseObject.depositData.venmoUsername
            );
          }
        } catch (error) {
          console.error('Error fetching payee details:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching intents:', error);
      setIntent(null);
    }
  }, [zkp2pClient]);

  useEffect(() => {
    if (zkp2pClient?.walletClient?.account) {
      fetchDeposits();
      fetchIntents();
    }
  }, [
    zkp2pClient,
    zkp2pClient?.walletClient?.account,
    fetchDeposits,
    fetchIntents,
  ]);

  const handleCreateDeposit = async () => {
    if (!zkp2pClient) return;
    setIsDepositLoading(true);
    setDepositHash(null);
    try {
      const result = await zkp2pClient.createDeposit({
        token: DEPLOYED_ADDRESSES[zkp2pClient.chainId]?.usdc as `0x${string}`,
        amount: BigInt(1000000),
        intentAmountRange: {
          min: BigInt(100000),
          max: BigInt(1000000),
        },
        conversionRates: [
          {
            currency: currencyInfo.USD?.currency as string,
            conversionRate: '1000000000000000000',
          },
        ],
        processorNames: ['venmo'],
        depositData: [
          {
            venmoUsername: 'ethereum',
          },
        ],
        onSuccess: (data) => {
          setDepositHash(data.hash);
        },
        onError: (error) => {
          console.error('Error creating deposit:', error);
        },
        onMined: (data) => {
          console.log('Deposit created:', data);
          fetchDeposits(); // Refresh deposits
        },
      });
      console.log('Create Deposit Result:', result);
    } catch (error) {
      console.error('Error in createDeposit:', error);
    } finally {
      setIsDepositLoading(false);
    }
  };

  const handleSignalIntent = async () => {
    if (!zkp2pClient || !firstActiveDeposit) return;
    setIsIntentLoading(true);
    setIntentTransactionHash(null);
    const payeeDetailsHash = getPayeeDetailsHash();
    if (!payeeDetailsHash) {
      console.error('No payee details hash found');
      return;
    }

    try {
      await zkp2pClient.signalIntent({
        processorName: 'venmo',
        depositId: firstActiveDeposit.depositId.toString(),
        tokenAmount: '1000000',
        payeeDetails: payeeDetailsHash,
        toAddress: zkp2pClient.walletClient?.account?.address as `0x${string}`,
        currency: currencyInfo.USD?.currency as string,
        onSuccess: (data) => {
          setIntentTransactionHash(data.hash);
        },
        onError: (error) => {
          console.error('Error signalling intent:', error);
        },
        onMined: (data) => {
          console.log('Intent signaled:', data);
          fetchIntents();
          fetchDeposits();
        },
      });
    } catch (error) {
      console.error('Error in signalIntent:', error);
    } finally {
      setIsIntentLoading(false);
    }
  };

  const handleWithdrawDeposit = async (depositId: string) => {
    if (!zkp2pClient) return;
    setIsWithdrawLoading(true);
    try {
      const params: WithdrawDepositParams = {
        depositId,
        onError: (error) => {
          console.error('Error withdrawing deposit:', error);
        },
        onMined: (data) => {
          console.log('Deposit withdrawn:', data);
          fetchDeposits();
          fetchIntents();
        },
      };
      const result = await zkp2pClient.withdrawDeposit(params);
      console.log('Withdraw Deposit Result:', result);
    } catch (error) {
      console.error('Error in withdrawDeposit:', error);
    } finally {
      setIsWithdrawLoading(false);
    }
  };

  const handleCancelIntent = async (intentHash: string) => {
    if (!zkp2pClient) return;
    setIsCancelLoading(true);
    try {
      const params: CancelIntentParams = {
        intentHash: intentHash as Hash,
        onError: (error) => {
          console.error('Error cancelling intent:', error);
        },
        onMined: (data) => {
          console.log('Intent cancelled:', data);
          fetchIntents();
        },
      };
      const result = await zkp2pClient.cancelIntent(params);
      console.log('Cancel Intent Result:', result);
    } catch (error) {
      console.error('Error in cancelIntent:', error);
    } finally {
      setIsCancelLoading(false);
    }
  };

  console.log('Intent:', intent);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ZKP2P API Functions</Text>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>Wallet Address:</Text>
        <Text style={styles.addressText}>
          {zkp2pClient?.walletClient?.account?.address || 'Not connected'}
        </Text>
        <Text style={styles.balanceLabel}>ETH Balance:</Text>
        <Text style={styles.balanceText}>{ethBalance} ETH</Text>
        <Text style={[styles.balanceLabel, styles.balanceLabelWithMargin]}>
          USDC Balance:
        </Text>
        <Text style={styles.balanceText}>{usdcBalance} USDC</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, isDepositLoading && styles.buttonDisabled]}
          onPress={handleCreateDeposit}
          disabled={isDepositLoading}
        >
          <Text style={styles.buttonText}>
            {isDepositLoading
              ? 'Creating Deposit...'
              : 'Create 1 USDC Deposit for Venmo'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            isIntentLoading && styles.buttonDisabled,
            !firstActiveDeposit && styles.buttonDisabled,
            !!intent && styles.buttonDisabled,
          ]}
          onPress={handleSignalIntent}
          disabled={isIntentLoading || !firstActiveDeposit || !!intent}
        >
          <Text style={styles.buttonText}>
            {isIntentLoading
              ? 'Signaling Intent...'
              : 'Signal Intent for 1 USDC for Venmo'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Deposits Table */}
      <View style={styles.tableContainer}>
        <Text style={styles.tableTitle}>Your Active Deposits</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText]}>ID</Text>
            <Text style={[styles.tableHeaderText]}>Amount</Text>
            <Text style={[styles.tableHeaderText]}>Action</Text>
          </View>
          {deposits.filter(
            (deposit) =>
              deposit.deposit.outstandingIntentAmount !== BigNumber.from(0)
          ).length === 0 && (
            <Text style={styles.emptyTableText}>No deposits found.</Text>
          )}
          {deposits
            .filter(
              (deposit) =>
                deposit.deposit.outstandingIntentAmount !== BigNumber.from(0)
            )
            .map((deposit) => (
              <View key={deposit.depositId.toString()} style={styles.tableRow}>
                <Text style={[styles.tableCell]}>
                  {deposit.depositId.toString()}
                </Text>
                <Text style={[styles.tableCell]}>
                  {Number(deposit.deposit.remainingDepositAmount) / 10 ** 6}
                </Text>
                <View>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.withdrawButton,
                      isWithdrawLoading && styles.buttonDisabled,
                    ]}
                    onPress={() =>
                      handleWithdrawDeposit(deposit.depositId.toString())
                    }
                    disabled={isWithdrawLoading}
                  >
                    <Text style={styles.actionButtonText}>
                      {isWithdrawLoading ? 'Withdrawing...' : 'Withdraw'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
        </View>
      </View>

      {/* Intents Table */}
      <View style={styles.tableContainer}>
        <Text style={styles.tableTitle}>Your Intents</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.flex2]}>
              Intent Hash
            </Text>
            <Text style={[styles.tableHeaderText]}>Amount</Text>
            <Text style={[styles.tableHeaderText]}>Venmo ID</Text>
            <Text style={[styles.tableHeaderText]}>Action</Text>
          </View>
          {!intent && (
            <Text style={styles.emptyTableText}>No intents found.</Text>
          )}
          {intent && (
            <View key={intent.intentHash} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.flex2]}>
                {intent.intentHash.slice(0, 8)}...
              </Text>
              <Text style={[styles.tableCell]}>
                {Number(intent.intent.amount) / 10 ** 6}
              </Text>
              <Text style={[styles.tableCell]}>{venmoUsername || '-'}</Text>
              <View>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.cancelButton,
                    isCancelLoading && styles.buttonDisabled,
                  ]}
                  onPress={() => handleCancelIntent(intent.intentHash)}
                  disabled={isCancelLoading}
                >
                  <Text style={styles.actionButtonText}>
                    {isCancelLoading ? 'Cancelling...' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {depositHash && (
        <View style={styles.successContainer}>
          <View>
            <Text style={styles.successText}>
              Deposit Created Successfully!
            </Text>
            <Text style={styles.hashText}>Transaction Hash: {depositHash}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setDepositHash(null)}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
        </View>
      )}
      {intentTransactionHash && (
        <View style={styles.successContainer}>
          <View>
            <Text style={styles.successText}>
              Intent Signalled Successfully!
            </Text>
            <Text style={styles.hashText}>
              Transaction Hash: {intentTransactionHash}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIntentTransactionHash(null)}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  buttonContainer: {
    gap: 15,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  proofButton: {
    backgroundColor: '#34C759',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e6ffe6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00cc00',
  },
  successText: {
    color: '#006600',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  hashText: {
    color: '#006600',
    fontSize: 14,
    flexShrink: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  tableContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  tableTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  table: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableHeaderText: {
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'left',
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    fontSize: 13,
    textAlign: 'left',
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  withdrawButton: {
    backgroundColor: '#FF9500', // Orange for withdraw
  },
  cancelButton: {
    backgroundColor: '#FF3B30', // Red for cancel
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyTableText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
    color: '#777',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 15,
  },
  closeButtonText: {
    color: '#006600',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 17,
  },
  balanceContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  balanceLabelWithMargin: {
    marginTop: 10,
  },
  addressText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  balanceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
});
