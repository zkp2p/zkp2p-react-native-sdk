/**
 * Bridge Factory
 * Creates and manages bridge instances with proper dependency injection
 */
import { GnarkBridge } from './GnarkBridge';
import { nativeModuleService } from '../services/NativeModuleService';

class BridgeFactoryImpl {
  private gnarkBridgeInstance: GnarkBridge | null = null;

  /**
   * Creates or returns existing GnarkBridge instance
   * @returns GnarkBridge instance or null if native module not available
   */
  getGnarkBridge(): GnarkBridge | null {
    if (this.gnarkBridgeInstance) {
      return this.gnarkBridgeInstance;
    }

    const gnarkModule = nativeModuleService.getGnarkModule();
    if (!gnarkModule) {
      return null;
    }

    try {
      this.gnarkBridgeInstance = new GnarkBridge(gnarkModule);
      return this.gnarkBridgeInstance;
    } catch (error) {
      console.error('[BridgeFactory] Failed to create GnarkBridge:', error);
      return null;
    }
  }

  /**
   * Disposes of all bridge instances
   */
  dispose(): void {
    if (this.gnarkBridgeInstance) {
      this.gnarkBridgeInstance.dispose();
      this.gnarkBridgeInstance = null;
    }
  }
}

// Create singleton instance
const bridgeFactoryInstance = new BridgeFactoryImpl();

// Export methods as a module to avoid class static pattern
export const BridgeFactory = {
  getGnarkBridge: () => bridgeFactoryInstance.getGnarkBridge(),
  dispose: () => bridgeFactoryInstance.dispose(),
};
