# NetworkArguments

NetworkArguments define the configuration for deploying smart contracts across various blockchain networks. This setup allows for specifying different deployment settings for each network, providing detailed control over the deployment process.

## Interface

```typescript
interface NetworkArguments<Abi extends ContractAbi = any> {
  [network: string]: NetworkArgument<Abi>;
}

interface NetworkArgument<Abi extends ContractAbi = any> {
  args: ContractConstructorArgs<Abi>;
  initData?: {
    initMethodName: keyof ContractMethods<Abi>;
    initMethodArgs: unknown[];
  };
}
```

## Usages

### NetworkArguments
  - **Description**: An object where each key is a network name registered on Sygma, mapped to their respective `NetworkArgument`. This structure facilitates network-specific deployment configurations, allowing for deployment across networks recognized by the Sygma protocol.
  - **Purpose**: Enables the deployment of contracts to specified networks, leveraging the configurations tailored for each network as recognized by Sygma.

### NetworkArgument
- **args**
  - **Description**: Constructor arguments for the contract on each specified network.
  - **Purpose**: Used for initializing the contract upon deployment.

- **initData**
  - **Description**: An optional object that specifies additional initialization to be performed after the contract's deployment. When used, it must include both `initMethodName` and `initMethodArgs`.
  - **initMethodName**
    - **Description**: Specifies the contract method to call for further initialization.
  - **initMethodArgs**
    - **Description**: An array of values that correspond to the parameters required by the method named in `initMethodName`. These arguments are passed directly to the initialization method call.

## Example

```typescript
const abi = [ ... ] as const;

const networks: NetworkArguments<typeof abi> = {
  sepolia: {
    args: [18, "zToken"],
    initData: {
      initMethodName: "setName",
      initMethodArgs: ["SuperToken"],
    }
  },
  goerli: {
    args: [18, "zToken"],
    initData: {
      initMethodName: "setName",
      initMethodArgs: ["GummyToken"],
    }
  },
};
```

This example shows how `NetworkArguments` can be used to deploy a contract with specific constructor arguments on the Sepolia and Goerli test networks. It includes optional post-deployment initialization to set unique token names for each network through the `setName` method.
