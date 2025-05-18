import { Zkp2pClient } from '../client';
import { base } from 'viem/chains';
import type { WalletClient } from 'viem';
import { createPublicClient, http } from 'viem';

jest.mock('viem', () => {
  const actual = jest.requireActual('viem');
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({})),
    http: jest.fn((url?: string) => ({ url })),
  };
});

const walletClient = {} as WalletClient;

describe('Zkp2pClient', () => {
  it('throws for unsupported chain without rpcUrl', () => {
    expect(
      () =>
        new Zkp2pClient({
          walletClient,
          apiKey: 'key',
          chainId: 99999,
        })
    ).toThrow('public client');
  });

  it('uses custom rpcUrl when provided', () => {
    const rpcUrl = 'https://rpc.example.com';
    new Zkp2pClient({
      walletClient,
      apiKey: 'key',
      chainId: base.id,
      rpcUrl,
    });
    expect(createPublicClient).toHaveBeenCalledWith({
      chain: base,
      transport: http(rpcUrl),
    });
  });
});
