export interface Spec {
  executeZkFunction(
    requestId: string,
    functionName: string,
    args: string[],
    algorithm: string
  ): Promise<void>;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}
