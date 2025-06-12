export function generateRpcRequestId(): string {
  return Math.random().toString(16).slice(2);
}

export function createRPCMessage(
  id: string,
  type: 'executeZkFunctionV3',
  request: any
): any {
  return {
    module: 'attestor-core',
    id,
    type,
    request,
  };
}

export function isRPCResponse(message: any): boolean {
  return (
    message && message.module === 'attestor-core' && message.isResponse === true
  );
}

export function parseRPCError(error: any): Error {
  if (error && error.message) {
    return new Error(error.message);
  }
  return new Error('Unknown RPC error');
}
