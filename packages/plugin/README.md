# ChainSafe's Hardhat Plugin for Multichain Deployment with Sygma

Unlock the full potential of Hardhat with Sygma: the premier plugin for effortlessly deploying your Ethereum smart contracts across multiple blockchain networks. Leveraging the Sygma protocol, this tool revolutionizes your deployment process, making it efficient, streamlined, and truly multi-chain. With ChainSafe's plugin, you're not just deploying contracts—you're exploring new possibilities within the blockchain ecosystem.

## Installation

To install, run:

```bash
npm install --save-dev @chainsafe/hardhat-plugin-multichain-deploy @buildwithsygma/sygma-sdk-core
```

### Importing the Plugin

For JavaScript users, add this line to your `hardhat.config.js`:

```js
require("@chainsafe/hardhat-plugin-multichain-deploy");
```

For TypeScript users, include it in your `hardhat.config.ts`:

```ts
import "@chainsafe/hardhat-plugin-multichain-deploy";
```

## Environment Extensions

The plugin adds a `multichain` namespace to the Hardhat Runtime Environment (HRE), introducing new methods for deployment:

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

- `contractName`: Name of the contract for deployment.
- `contractBytecode`: Compiled bytecode of the contract.
- `contractAbi`: Contract ABI, detailing methods and structures for interaction.
- `networkArgs`: Maps network identifiers to deployment arguments. Refer to [NetworkArguments.md](../../docs/plugin/NetworkArguments.md) for more.
- `options`: Optional deployment settings. Details in [DeployOptions.md](../../docs/plugin/DeployOptions.md).

## Environment Variable

- `ADAPTER_ADDRESS`: Address of the adapter, facilitating deployment across chains with Sygma. Use this if deploying custom adapters.

## Configuration

To utilize the Multichain Deployment plugin, specific settings are required:

- `multichain` namespace: Configures deployment settings.
   - `environment`: Defines the Sygma environment. Use `Environment` from `@buildwithsygma/sygma-sdk-core` for constants.

### Example Configuration

```typescript
import { Environment } from "@buildwithsygma/sygma-sdk-core";

const config: HardhatUserConfig = {
    // Other configurations...
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

## Usage

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

To contribute to this project, please see the [monorepo readme](../../README.md) for guidelines.
