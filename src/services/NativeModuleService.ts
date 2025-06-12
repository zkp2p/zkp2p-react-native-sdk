/**
 * Native Module Service
 * Centralizes native module initialization and management
 */
import { NativeModules } from 'react-native';
import type { Spec as GnarkModuleSpec } from '../NativeZkp2pGnarkModule';

export interface NativeModuleServiceInterface {
  getGnarkModule(): GnarkModuleSpec | null;
  isGnarkAvailable(): boolean;
}

class NativeModuleServiceImpl implements NativeModuleServiceInterface {
  private gnarkModule: GnarkModuleSpec | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    try {
      // Check if the gnark module is available in NativeModules
      const module = NativeModules.Zkp2pGnarkModule as
        | GnarkModuleSpec
        | undefined;

      if (module && typeof module.executeZkFunction === 'function') {
        this.gnarkModule = module;
      } else {
        console.warn(
          '[NativeModuleService] Gnark module not available or invalid'
        );
      }
    } catch (error) {
      console.error(
        '[NativeModuleService] Failed to load native modules:',
        error
      );
    }

    this.initialized = true;
  }

  getGnarkModule(): GnarkModuleSpec | null {
    return this.gnarkModule;
  }

  isGnarkAvailable(): boolean {
    return this.gnarkModule !== null;
  }
}

// Create singleton instance
const serviceInstance = new NativeModuleServiceImpl();

// Export service interface
export const nativeModuleService: NativeModuleServiceInterface = {
  getGnarkModule: () => serviceInstance.getGnarkModule(),
  isGnarkAvailable: () => serviceInstance.isGnarkAvailable(),
};
