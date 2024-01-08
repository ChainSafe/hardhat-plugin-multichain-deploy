# Chainsafe's Hardhat Plugin for Multichain deployment with Sygma

Experience the seamless integration of Hardhat with Sygma: the ultimate plugin for effortlessly deploying your Ethereum smart contracts across multiple chains.  
Embrace the power of Sygma protocol, and transform your deployment process into a streamlined, efficient, and multi-chain adventure.  
With this tool, you're not just deploying contracts; you're unlocking new horizons in the blockchain ecosystem.


## Installation

```bash
npm install --save-dev @chainsafe/hardhat-plugin-multichain-deploy
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
 * `async waitInitialization(): Promise<void>`: Returns a promise. Wait for this promise to resolve to ensure readiness for using Sygma.
 * `async deployMultichain(nameOrBytecode: string, arguments: string[], options?: Object): Promise<TxHash>`: Deploys a smart contract.
   * `nameOrBytecode`: Name or bytecode of the smart contract.
   * `arguments`: Arguments for the smart contract deployment.
   * `options`: Additional deployment options (details TBD).

## Configuration

The Hardhat Plugin Multichain Deployment plugin requires specific configurations for successful multi-chain deployment.

This plugin extends introduce new name space called `multichain` with options:
 * `environment`: Specifies the Sygma environment for deployment.
   * Import `Environment` from `@buildwithsygma/sygma-sdk-core` for constant values.
   * Options: `mainnet`, `testnet`, `devnet`, `local`.
 * `deploymentNetworks`: List of networks for deployment.
   * Ensure network names match those in `networks`.
   * Networks must correspond with Sygma routes. Refer to [Sygma documentation](https://docs.buildwithsygma.com/environments) for routes.

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
        deploymentNetworks: ["sepolia", "optimisticGoerli"],
    },
};
```

## Usages

### TODO

After familiarizing yourself with the capabilities, let's see how everything works together.  

Example scenario: You've created an ERC20 contract and want to deploy it across multiple chains using the configuration mentioned above.
```typescript
// Deploy the contract
const tx = await hre.multichain.deployMultichain('MySuperToken', [name, symbol, decimals], { singer: web3signer });

console.log("Transaction Hash: ", tx);
```

## Contribution

For contributing to the project, please refer to the [root readme](../../README.md) file.
