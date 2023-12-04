import { extendConfig, extendEnvironment } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import {
  HardhatConfig,
  HardhatUserConfig,
  MultichainConfig,
} from "hardhat/types";

import { MultichainHardhatRuntimeEnvironmentField } from "./MultichainHardhatRuntimeEnvironmentField";

import "./type-extensions";

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    const multichainConfig = userConfig.multichain || {};

    if (
      !multichainConfig.deploymentNetworks ||
      !multichainConfig.deploymentNetworks.length
    ) {
      console.warn(
        "Warning: Missing Deployment Networks - It appears that you have not provided the Deployment Networks. To avoid potential issues, it is recommended that you supply these values. If they are not provided, you will be required to enter them manually as parameters. Please ensure that the necessary information is included to facilitate a smoother process."
      );
      multichainConfig.deploymentNetworks = [];
    }

    /** Validates that all networks in 'deploymentNetworks' are defined in 'config.networks'. */
    const missedNetworks: string[] = [];
    const configNetworkKeys = Object.keys(config.networks);
    multichainConfig.deploymentNetworks.forEach((networkName) => {
      if (!configNetworkKeys.includes(networkName))
        missedNetworks.push(networkName);
    });
    if (missedNetworks.length)
      throw new Error(
        `Missing Configuration for Deployment Networks: ${missedNetworks
          .join(", ")
          .replace(/, ([^,]*)$/, " and $1")}\n` +
          `The above networks are listed in your 'deploymentNetworks' but they are not defined in 'config.networks'. ` +
          `Please ensure each of these networks is properly configured in the 'config.networks' section of your configuration.`
      );

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
