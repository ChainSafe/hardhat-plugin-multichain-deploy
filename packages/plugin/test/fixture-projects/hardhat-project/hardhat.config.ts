// We load the plugin here.
import {HardhatUserConfig} from "hardhat/types";
import {Environment} from "@buildwithsygma/sygma-sdk-core";

import "../../../src/index";

const config: HardhatUserConfig = {
  solidity: "0.7.3",
  defaultNetwork: "goerli",
  networks: {
    sepolia: {
      chainId: 11155111,
      url: 'https://localhost:8080'
    },
    goerli: {
      chainId: 5,
      url: 'https://localhost:8080'
    },
    goerliNoChainId: {
      url: 'https://localhost:8080'
    }
  },
  multichain: {
    environment: Environment.TESTNET,
  },
};

export default config;
