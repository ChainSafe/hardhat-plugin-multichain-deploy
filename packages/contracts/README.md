# hardhat-plugin-multichain-deploy/contracts

CrosschainDeployAdapter contract is meant to be used in conjunction with CreateX and Sygma projects to allow for seamless same address cross chain contracts deployment. Bytecode and constructor params of the deployed contract does not affect the resulting address, which makes it even more convenient.

Expected user flow is to call `Adapter.calculateDeployFee()` to get a list of fee amounts needed for each target domain deployment. Then user should send transaction `Adapter.deploy(..., fees, {value: feesSum})` that will in turn call PermissionlessGenericHandler of Sygma, that will trigger deployments of the specified bytecode across desired domain ids (chains).

### Example usage

	yarn run hardhat --network sepolia crosschain-deploy --contractname HelloSygma --destinationdomains 2,7 --constructorarguments 4 --initfunctions setName,setName --initarguments sepolia,mumbai --gaslimit 500000 --salt 0x0000000000000000000000000000000000000000000000000000000000000004

This will deploy the example HelloSygma contract to Sepolia and Mumbai testnets onto the same address, using different initalization calls.

### Chainsafe Documentation

Each function has detailed natspec comments for those that know how to read Solidity.

### Install

    node 18.x is required
    yarn install
    yarn run build

### Docs

    yarn run hardhat docgen

### Deployment

To deploy to live networks, create a `.env` file using the `.env.example` and fill in the relevant variables (only the ones needed for your deployment).
You need to have a private key specified. Make sure to use a freshly generated private key if CreateX is not deployed yet. Also make sure to use the same private key across networks deployment.
To deploy to Ethereum Sepolia Testnet do:

    yarn run hardhat --network sepolia deploy

To deploy to other networks, replace the `mainnet` with the network name from the supported list:

    sepolia
    mumbai

You could optionally set your ETHERSCAN_API key, and use `--verify true` in order to publish the source code after deployemnt.
