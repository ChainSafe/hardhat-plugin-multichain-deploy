import {HardhatUserConfig, vars} from "hardhat/config";
import {Environment} from "@buildwithsygma/sygma-sdk-core";

import "@nomicfoundation/hardhat-toolbox";
import "@chainsafe/hardhat-ts-artifact-plugin";
import "@chainsafe/hardhat-plugin-multichain-deploy";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      chainId: 11155111,
      url: "https://ethereum-sepolia.publicnode.com",
      accounts: vars.has("PK") ? [vars.get("PK")] : [],
    },
    mumbai: {
      chainId: 80001,
      url: "https://gateway.tenderly.co/public/polygon-mumbai",
      accounts: vars.has("PK") ? [vars.get("PK")] : [],
    },
  },
  multichain: {
    environment: Environment.TESTNET,
  }
};

export default config;
