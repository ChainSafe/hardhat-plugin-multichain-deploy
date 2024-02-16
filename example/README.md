# Example Multichain Deployment

This guide provides a walkthrough for a basic multichain deployment scenario, illustrating how to deploy a sample smart contract across multiple blockchain networks. This example is designed to showcase the versatility and ease of managing deployments in a multichain environment using Hardhat.

## Getting Started

Before diving into the deployment process, you must first set up your environment. This involves adding your private key to the project configuration. Your private key is essential for signing transactions during the deployment process. To set up your environment, execute the following command in your terminal:

```shell
npx hardhat var set PK
```

## Deployment Options

This example offers three distinct deployment scripts, each catering to different deployment scenarios. Depending on your requirements, you can choose the script that best fits your needs.

### Option 1: Deploy Using Contract Name
Deploy your contract to the Sepolia network (or any other specified network) by executing:

```shell
npx hardhat run scripts/deployMultichain.ts --network sepolia
```

This command compiles the contract and deploys it using the compiled artifacts. It's suited for scenarios where the contract's source code is the starting point for deployment.

### Option 2: Deploy Using Bytecode

If you prefer to deploy your contract using its bytecode, execute this command:

```shell
npx hardhat run scripts/deployMultichainBytecode.ts --network sepolia
```

This method is useful when you want to deploy the same contract bytecode across multiple networks without recompiling the contract.

### Option 3: Localhost Deployment

For local testing and development, you can deploy the contract to a simulated blockchain environment running on your local machine:

```shell
npx hardhat run scripts/localhost.ts
```

This option is perfect for developers seeking to test their contracts in a controlled environment without the need for real network connections.

## Exploring the Implementation

To delve deeper into the deployment process and customize it to your needs, you can review and modify the scripts located in the `scripts` folder. Each script is designed to demonstrate different aspects of multichain deployment, offering a practical insight into deploying smart contracts across various blockchain networks.
