import CrosschainDeployAdapter from "@chainsafe/hardhat-plugin-multichain-deploy-contracts/artifacts/contracts/CrosschainDeployAdapter.sol/CrosschainDeployAdapter";
import CreateX from "@chainsafe/hardhat-plugin-multichain-deploy-contracts/artifacts/contracts/deps/CreateX.sol/CreateX";
import MockFeeHandler from "@chainsafe/hardhat-plugin-multichain-deploy-contracts/artifacts/contracts/mocks/MockFeeHandler.sol/MockFeeHandler";
import MockBridge from "@chainsafe/hardhat-plugin-multichain-deploy-contracts/artifacts/contracts/mocks/MockBridge.sol/MockBridge";

export const AdapterABI = CrosschainDeployAdapter.abi;
export const AdapterBytecode = CrosschainDeployAdapter.bytecode;

export const CreateXABI = CreateX.abi;
export const CreateXBytecode = CreateX.bytecode;

export const MockFeeHandlerABI = MockFeeHandler.abi;
export const MockFeeHandlerBytecode = MockFeeHandler.bytecode;

export const MockBridgeABI = MockBridge.abi;
export const MockBridgeBytecode = MockBridge.bytecode;
