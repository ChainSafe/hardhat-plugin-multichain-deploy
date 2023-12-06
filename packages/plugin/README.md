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

Package introduce not `multichain` name space to the `hre`

This will introduce few new methods:
 * `async waitInitialization()`
   * takes no arguments and return promise you can wait to resolve to ensure you can use sygma.
 * `async deployMultichain(nameOrBytecode: string, arguments: string[], options?: Object): Promise<TxHash>`
   * `name` or `bytcode` of smart contract you want to deploy
   * `arguments` that will be provided to smart contract deployment
   * `options` TODO bro!

## Configuration

Hardhat Plugin Multichain deployment plugin introduce few options that are required for successfully deploying contract on multiple chains.

This plugin extends introduce new name space called `multichain` with options:
 * `environment`: represents Sygma environment used for deployment
   * import `Environment` from `@buildwithsygma/sygma-sdk-core` to use it as safe constants
   * possible options: `mainnet`, `testnet`, `devnet` and `local`
 * `deploymentNetworks`: list of network that will be used for deployment
   * listed network names need to match networks listed inside `networks`
   * list of networks need to be part of sygma routes. For list of routes please reference to [Sygma documentation](https://docs.buildwithsygma.com/environments).

This is an example of how to set it:

```typescript
import {Environment} from "@buildwithsygma/sygma-sdk-core";

const config: HardhatUserConfig = {
    solidity: "0.7.3",
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

#### TODO

As now, you are familiar with all capabilities ^^ lets see how everything works together.  
Here is scenario, made contract erc20 contract and want to deploy it on multiple chains. You made config similar from configuration part.

your code will be looks something like this

```typescript
// wait to deployer finish initialization
await hre.multichain.waitInitialization();

// deploy a contract
const tx = await hre.multichain.deployMultichain('MySuperToken', [name, symbol, decimals], { singer: web3signer });

console.log("My TX: ", tx);
```

## Contribution

Refer to [root readme](../../README.md) file