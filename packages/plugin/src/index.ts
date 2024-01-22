import { extendConfig, extendEnvironment } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import {
  HardhatConfig,
  HardhatUserConfig,
  MultichainConfig,
} from "hardhat/types";
import { Environment } from "@buildwithsygma/sygma-sdk-core";
import { MultichainHardhatRuntimeEnvironmentField } from "./MultichainHardhatRuntimeEnvironmentField";
import "./type-extensions";

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    const multichainConfig = Object.assign({}, userConfig.multichain);

    if (!multichainConfig.environment) {
      console.warn(
        "Warning: Missing 'environment' setting. Defaulting to ",
        Environment.TESTNET
      );
      multichainConfig.environment = Environment.TESTNET;
    }

    config.multichain = multichainConfig as MultichainConfig;
  }
);

extendEnvironment((hre) => {
  // We add a field to the Hardhat Runtime Environment here.
  // We use lazyObject to avoid initializing things until they are actually
  // needed.
  hre.multichain = lazyObject(
    () => new MultichainHardhatRuntimeEnvironmentField(hre)
  );
});
