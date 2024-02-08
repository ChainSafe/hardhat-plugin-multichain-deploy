// We load the plugin here.
import { HardhatUserConfig } from "hardhat/types";
import { Environment } from "@buildwithsygma/sygma-sdk-core";

import "../../../src/index";

const config: HardhatUserConfig = {
  solidity: "0.7.3",
  defaultNetwork: "hardhat",
  multichain: {
    environment: Environment.TESTNET,
  },
};

export default config;
