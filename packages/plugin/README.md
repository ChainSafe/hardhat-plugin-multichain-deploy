# Chainsafe's Hardhat Plugin for Multichain deployment with Sygma

Experience the seamless integration of Hardhat with Sygma: the ultimate plugin for effortlessly deploying your Ethereum smart contracts across multiple chains.  
Embrace the power of Sygma protocol, and transform your deployment process into a streamlined, efficient, and multi-chain adventure.  
With this tool, you're not just deploying contracts; you're unlocking new horizons in the blockchain ecosystem.

## Installation

```bash
npm install --save-dev @chainsafe/hardhat-plugin-multichain-deploy @buildwithsygma/sygma-sdk-core
```

Import the plugin in your `hardhat.config.js``:

```js
require("@chainsafe/hardhat-plugin-multichain-deploy");
```

Or if you are using TypeScript, in your `hardhat.config.ts``:

```js
import "@chainsafe/hardhat-plugin-multichain-deploy";
```

## Environment extensions

The package introduces a `multichain` namespace to the Hardhat Runtime Environment (HRE).

New methods introduced:
```ts
async deployMultichain<Abi extends ContractAbi = any>(
        contractName: string,
        networkArgs: NetworkArguments<Abi>,
        options?: DeployOptions
): Promise<{
   deploymentInfo: DeploymentInfo[];
   receipt: Transaction;
} | void>

async deployMultichainBytecode<Abi extends ContractAbi = any>(
        contractBytecode: string,
        contractAbi: Abi,
        networkArgs: NetworkArguments<Abi>,
        options?: DeployOptions
): Promise<{
   deploymentInfo: DeploymentInfo[];
   receipt: Transaction;
} | void>
```

 * `contractName`: The name of the contract to be deployed.
 * `contractBytecode`: The bytecode of the contract to be deployed. This is the compiled code of the contract.
 * `contractAbi`: The ABI of the contract. It defines the methods and structures used to interact with the binary contract.
 * `networkArgs`: An object mapping network identifiers to their deployment arguments. Each network can have unique settings for the deployment. See [NetworkArguments.md](../../docs/plugin/NetworkArguments.md)
 * `options`: Optional settings for the deployment process. These can include various configurations specific to the deployment. See [DeployOptions.md](../../docs/plugin/DeployOptions.md)

## Environment variable

 - `ADAPTER_ADDRESS` - address of adapter (adapter is used to propagate all deployment on other chains with help of sygma). It can be used in case if you deploy own adapters

## Configuration

The Hardhat Plugin Multichain Deployment plugin requires specific configurations for successful multichain deployment.

This plugin extends introduce new name space called `multichain` with options:
 * `environment`: Specifies the Sygma environment for deployment.
   * Import `Environment` from `@buildwithsygma/sygma-sdk-core` for constant values.
   * Options: `mainnet`, `testnet`, `devnet`, `local`.

Example configuration:

```typescript
import { Environment } from "@buildwithsygma/sygma-sdk-core";

const config: HardhatUserConfig = {
    // ... other configurations ...
    defaultNetwork: "goerli",
    networks: {
        sepolia: { ... },
        goerli: { ... },
        optimisticGoerli: { ... },
    },
    multichain: {
        environment: Environment.TESTNET,
    },
};
```

## Usages

With the setup complete, let’s deploy an ERC20 contract across multiple chains:

```typescript
const networkArgs = {
   sepolia: {
     args: [name, symbol, decimals],
   },
   goerli: {
      args: [name, symbol, decimals],
   },
};
const options = {
   salt: "0xcafe00000000000000000000000000000000000000000000000000000000cafe",
};

this.hre.multichain.deployMultichain("MySuperToken", networkArgs, options);
```

## Contribution

For contributing to the project, please refer to the [monorepo readme](../../README.md) file.
