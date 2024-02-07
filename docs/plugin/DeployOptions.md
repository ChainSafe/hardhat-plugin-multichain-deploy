# DeployOptions

DeployOptions provides additional configuration settings for deploying smart contracts across multiple blockchain networks. These options allow for customization of the deployment process, including contract address generation, network-specific deployments, and transaction settings.

## Interface

```ts
interface DeployOptions {
  salt?: MatchPrimitiveType<"bytes32", unknown>;
  isUniquePerChain?: boolean;
  customNonPayableTxOptions?: NonPayableCallOptions;
  adapterAddress?: Address;
}
```

## Usages

### salt
- **Description**: Provides entropy for generating a unique contract address. This can be a hexadecimal string `HexString` or a `Uint8Array`.
- **Purpose**: Used to create a predictable yet unique address for the smart contract across different deployments.

### isUniquePerChain
- **Description**: A boolean flag that, when set to true, ensures the contract is deployed with distinct addresses on each blockchain network.

### customNonPayableTxOptions
- **Details**: Customizes transaction settings for contract calls. This option allows setting sender details and other transaction parameters.
- **Reference**: For detailed information about `NonPayableCallOptions`, please refer to the [web3.js documentation](https://docs.web3js.org/api/web3-types/interface/NonPayableCallOptions/).

### adapterAddress
- **Description**: Specifies address of a custom adapter for deployments. This is useful for local testing or when needing to interact with a specific deployment strategy, such as a mocked adapter.
- **Purpose**: Allows the user to override the default deployment adapter with their own, providing greater flexibility and control over the deployment process.

## Example

In this example, `DeployOptions` is configured to deploy a contract with a specified salt for address generation, ensuring unique addresses on each chain, and customizing the sender address for the deployment transaction.

```ts
const options: DeployOptions = {
  salt: "0x0d832502cc5af3e4cf5c9118b013acea29808616be3bd44f89d231c1c56af61f",
  isUniquePerChain: true,
  customNonPayableTxOptions: {
    from: "0x1605B51d318bFfBFd246D565Ee55522b66ddc34a",
  },
  adapterAddress: "0x1234567890ABCDEF1234567890ABCDEF12345678"
};
```

This setup ensures a predictable and unique deployment process tailored to specific requirements of a multichain environment.