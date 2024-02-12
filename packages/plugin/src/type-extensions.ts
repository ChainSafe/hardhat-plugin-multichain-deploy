import "hardhat/types/config";
import "hardhat/types/runtime";

import type { MultichainHardhatRuntimeEnvironmentField } from "./MultichainHardhatRuntimeEnvironmentField";
import type { MultichainConfig } from "./types";

declare module "hardhat/types/config" {
  /**
   * Typings for config that can be used for using by hardhat.
   */
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
