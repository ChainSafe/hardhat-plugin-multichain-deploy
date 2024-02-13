import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-web3-v4";
import "@chainsafe/hardhat-ts-artifact-plugin";

import "@chainsafe/hardhat-plugin-multichain-deploy";
import {Environment} from "@buildwithsygma/sygma-sdk-core";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      chainId: 11155111,
      url: "https://ethereum-sepolia.publicnode.com",
      accounts: [],
    },
  },
  multichain: {
    environment: Environment.TESTNET,
  }
};

export default config;
