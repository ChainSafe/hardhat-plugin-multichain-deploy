import "hardhat/types/config";
import "hardhat/types/runtime";

import { Environment } from "@buildwithsygma/sygma-sdk-core";
import { MultichainHardhatRuntimeEnvironmentField } from "./MultichainHardhatRuntimeEnvironmentField";

declare module "hardhat/types/config" {
  /**
   * Typings for config that can be used for using by hardhat.
   */

  export interface MultichainConfig {
    environment: Environment;
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
