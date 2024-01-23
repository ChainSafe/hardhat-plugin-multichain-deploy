# NetworkArguments

NetworkArguments define the configuration for deploying smart contracts across various blockchain networks. This structure allows for specifying different deployment settings for each network, enabling more granular control over the deployment process.

## Interface

```ts
interface NetworkArguments<Abi extends ContractAbi = any> {
  [network: string]: NetworkArgument<Abi>;
}

interface NetworkArgument<Abi extends ContractAbi = any> {
  args: ContractConstructorArgs<Abi>;
  initData?: string;
}
```

## Usages

### NetworkArguments
- **Description**: A collection mapping network names from `hardhat.config.ts` to their respective `NetworkArgument`. Only the networks intended for deployment need to be specified.
- **Purpose**: Facilitates the deployment of contracts to selected networks with customized settings.

### NetworkArgument
- **args**
  - **Description**: The arguments passed to the contract's constructor for the specified network.
  - **Purpose**: Used to initialize and configure the contract upon deployment for each specific network.
- **initData**
  - **Description**: An optional string for additional initialization data (often a hexadecimal string).
  - **Purpose**: Enables providing extra setup or configuration data, usually used in conjunction with the contract's initialization method.

## Example

### Example `hardhat.config.ts`
```ts
const config: HardhatUserConfig = {
  networks: {
    sepolia: { ... },
    goerli: { ... }
  },
  multichain: {
    environment: Environment.TESTNET,
  },
};
```

### Example Usage with Above Config
```ts
const abi = [ ... ] as const;

const networks: NetworkArguments<typeof abi> = {
  sepolia: {
    args: [18, "zToken"],
  },
  goerli: {
    args: [18, "zToken"]
  },
};
```

This example demonstrates how to define `NetworkArguments` for deploying a contract with specific constructor arguments on the Sepolia and Goerli test networks.
