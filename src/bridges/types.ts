export type ZKFunctionType = 'groth16Prove' | 'initAlgorithm';

export interface ExecuteZKOpts {
  id: string;
  functionName: ZKFunctionType;
  args: any[];
  algorithm?: string;
}

export type RPCMessageType = 'executeZkFunctionV3' | 'zkFunctionDone' | 'error';

export interface RPCMessage {
  type: RPCMessageType;
  id: string;
  request?: ExecuteZKOpts;
  response?: any;
  error?: { message: string };
}

export interface ZKBridge {
  executeZKFunction(opts: ExecuteZKOpts): Promise<void>;
}
