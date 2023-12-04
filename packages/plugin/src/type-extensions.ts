// If your plugin extends types from another plugin, you should import the plugin here.

// To extend one of Hardhat's types, you need to import the module where it has been defined, and redeclare it.
import "hardhat/types/config";
import "hardhat/types/runtime";

import { MultichainHardhatRuntimeEnvironmentField } from "./MultichainHardhatRuntimeEnvironmentField";

declare module "hardhat/types/config" {
  /**
   * Typings for config that can be used for using by hardhat.
   */

  export interface MultichainConfig {
    deploymentNetworks: string[];
  }

  export interface HardhatUserConfig {
    multichain?: Partial<MultichainConfig>;
  }

  export interface HardhatConfig {
    multichain: MultichainConfig;
  }
}

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    multichain: MultichainHardhatRuntimeEnvironmentField;
  }
}
