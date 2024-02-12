import "hardhat/types/config";
import "hardhat/types/runtime";

import type { Environment } from "@buildwithsygma/sygma-sdk-core";
import type { MultichainHardhatRuntimeEnvironmentField } from "./MultichainHardhatRuntimeEnvironmentField";

declare module "hardhat/types/config" {
  /**
   * Typings for config that can be used for using by hardhat.
   */

  interface MultichainConfig {
    environment: Environment;
  }

  interface HardhatUserConfig {
    multichain?: Partial<MultichainConfig>;
  }

  interface HardhatConfig {
    multichain: MultichainConfig;
  }
}

declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    multichain: MultichainHardhatRuntimeEnvironmentField;
  }
}
