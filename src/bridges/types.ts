export type ZKFunctionType =
  | 'generateWitness'
  | 'groth16Prove'
  | 'groth16Verify'
  | 'prove';

export type OPRFFunctionType =
  | 'generateWitness'
  | 'groth16Prove'
  | 'groth16Verify'
  | 'generateThresholdKeys'
  | 'generateOPRFRequestData'
  | 'finaliseOPRF'
  | 'evaluateOPRF';

export interface ExecuteZKOpts {
  requestId: string;
  functionName: ZKFunctionType;
  args: any[];
  algorithm: string;
}

export interface ExecuteOPRFOpts {
  requestId: string;
  functionName: OPRFFunctionType;
  args: any[];
  algorithm: string;
}

export interface WindowRPCMessage {
  module: 'attestor-core';
  id: string;
  type:
    | 'executeZkFunctionV3'
    | 'executeOprfFunctionV3'
    | 'response'
    | 'error'
    | 'zkFunctionDone'
    | 'oprfFunctionDone';
  request?: ExecuteZKOpts | ExecuteOPRFOpts;
  response?: any;
  error?: any;
}

export interface CommunicationBridge {
  executeZKFunction(opts: ExecuteZKOpts): Promise<void>;
  executeOPRFFunction(opts: ExecuteOPRFOpts): Promise<void>;
  addListener(callback: (message: WindowRPCMessage) => void): void;
  removeListener(callback: (message: WindowRPCMessage) => void): void;
  dispose(): void;
}
