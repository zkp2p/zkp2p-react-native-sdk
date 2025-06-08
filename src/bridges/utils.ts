import type { CommunicationBridge, WindowRPCMessage } from './types';

export function generateRpcRequestId(): string {
  return Math.random().toString(16).slice(2);
}

export function waitForResponse(
  type: 'executeZkFunctionV3' | 'executeOprfFunctionV3',
  id: string,
  bridge: CommunicationBridge,
  timeout: number = 30000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      bridge.removeListener(listener);
      reject(new Error(`RPC timeout for ${type} with id ${id}`));
    }, timeout);

    const listener = (message: WindowRPCMessage) => {
      if (message.id === id) {
        clearTimeout(timer);
        bridge.removeListener(listener);

        if (message.type === 'error') {
          reject(new Error(message.error?.message || 'Unknown error'));
        } else {
          resolve(message.response);
        }
      }
    };

    bridge.addListener(listener);
  });
}
