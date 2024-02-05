import CrosschainDeployAdapter from "@chainsafe/hardhat-plugin-multichain-deploy-contracts/artifacts/contracts/CrosschainDeployAdapter.sol/CrosschainDeployAdapter";
import CreateX from "@chainsafe/hardhat-plugin-multichain-deploy-contracts/artifacts/contracts/deps/CreateX.sol/CreateX";

export const AdapterABI = CrosschainDeployAdapter.abi;
export const AdapterBytecode = CrosschainDeployAdapter.bytecode;

export const CreateXABI = CreateX.abi;
export const CreateXBytecode = CreateX.bytecode;
