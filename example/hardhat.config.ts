import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@chainsafe/hardhat-plugin-multichain-deploy";
import {Environment} from "@buildwithsygma/sygma-sdk-core";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  defaultNetwork: 'sepolia',
  multichain: {
    environment: Environment.TESTNET,
  },
};

export default config;
