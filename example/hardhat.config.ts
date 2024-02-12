import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-web3-v4";
import "@chainsafe/hardhat-ts-artifact-plugin";

import "@chainsafe/hardhat-plugin-multichain-deploy";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  "ts-artifact": {},
};

export default config;
