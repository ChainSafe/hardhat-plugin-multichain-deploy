import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Config, Domain } from "@buildwithsygma/sygma-sdk-core";
import Web3, { ContractAbi, utils } from "web3";
import { vars } from "hardhat/config";
import {
  getConfigEnvironmentVariable,
  getNetworkChainId,
  sumedFees,
  mapNetworkArgs,
  pollTransferStatusUntilResolved,
} from "./utils";
import {
  AdapterABI,
  AdapterBytecode,
  CreateXABI,
  CreateXBytecode,
  MockBridgeABI,
  MockBridgeBytecode,
  MockFeeHandlerABI,
  MockFeeHandlerBytecode,
} from "./adapterABI";
import {
  DeployOptions,
  NetworkArguments,
  DeployMultichainResponse,
  DeployedLocalEnvironmentContracts,
} from "./types";

export class MultichainHardhatRuntimeEnvironmentField {
  private isInitiated: boolean = false;
  private domains: Domain[] = [];
  private readonly web3: Web3;

  public constructor(private readonly hre: HardhatRuntimeEnvironment) {
    const provider = this.hre.network.provider;
    this.web3 = new Web3(provider);
  }

  private ADAPTER_ADDRESS = vars.get(
    "ADAPTER_ADDRESS",
    "0x85d62ad850b322152bf4ad9147bfbf097da42217"
  );

  //current Sygma hardcoded gasLimit
  private gasLimit = 1000000;

  private async initConfig(): Promise<void> {
    const originChainId = await getNetworkChainId(
      this.hre.network.name,
      this.hre
    );
    const environment = getConfigEnvironmentVariable(this.hre);

    const config = new Config();
    await config.init(originChainId, environment);

    this.domains = config.getDomains();

    this.isInitiated = true;
  }

  /**
   * Initializes the local development environment by deploying mock contracts necessary for testing interactions with the Sygma Bridge through Adapter contracts. This setup is vital for developers aiming to simulate the deployment process and contract interactions within a local and controlled environment, closely replicating interactions with the Sygma Bridge in production.
   *
   * @param deployer - Optional. The Ethereum address of the deployer account. If not provided, the method defaults to using the first available account. This account is tasked with deploying the mock contracts and is essential for setting up the local testing environment.
   * @returns A `Promise` that resolves to an object containing the addresses of the deployed mock contracts. These addresses are crucial for conducting further development or testing, enabling comprehensive interaction with the contracts.
   *
   * @example
   * const { adapterAddress } = await initLocalEnvironment();
   *
   * const options = {
   *    salt: "0xcafe00000000000000000000000000000000000000000000000000000000cafe",
   *    adapterAddress,
   * };
   * await this.hre.multichain.deployMultichain("HelloContract", networkArgs, options);
   */
  public async initLocalEnvironment(
    deployer?: string
  ): Promise<DeployedLocalEnvironmentContracts> {
    // Assign default values if is not provided
    if (!deployer) deployer = (await this.web3.eth.getAccounts())[0];

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    /** Deploy Mock Sygma Bridge */
    const DOMAIN_ID = BigInt(1);

    const feeHandler = new this.web3.eth.Contract(MockFeeHandlerABI);
    const feeHandlerResponse = await feeHandler
      .deploy({ data: MockFeeHandlerBytecode })
      .send({ from: deployer });
    const feeHandlerAddress =
      feeHandlerResponse.options.address || ZERO_ADDRESS;

    const bridge = new this.web3.eth.Contract(MockBridgeABI);
    const bridgeResponse = await bridge
      .deploy({
        data: MockBridgeBytecode,
        arguments: [deployer, feeHandlerAddress, DOMAIN_ID],
      })
      .send({ from: deployer });
    const bridgeAddress = bridgeResponse.options.address || ZERO_ADDRESS;

    /** Deploy Adapter */
    const RESOURCE_ID =
      "0x000000000000000000000000000000000000000000000000000000000000cafe";

    const createX = new this.web3.eth.Contract(CreateXABI);
    const createXResponse = await createX
      .deploy({
        data: CreateXBytecode,
      })
      .send({ from: deployer });
    const createXAddress = createXResponse.options.address || ZERO_ADDRESS;
    console.log(`CreateX locally deployed: ${createXAddress}`);

    const adapter = new this.web3.eth.Contract(AdapterABI);
    const adapterResponse = await adapter
      .deploy({
        data: AdapterBytecode,
        arguments: [createXAddress, bridgeAddress, RESOURCE_ID],
      })
      .send({ from: deployer });
    const adapterAddress = adapterResponse.options.address || ZERO_ADDRESS;

    console.log(
      `Adapter locally deployed: ${adapterAddress}` +
        "\n" +
        "Local environment initiated"
    );

    return {
      adapterAddress,
      createXAddress,
      bridgeAddress,
      feeHandlerAddress,
    };
  }

  /**
   * Deploys a contract to multiple blockchain networks.
   *
   * @param contractName - The name of the contract to be deployed.
   * @param networkArgs - An object mapping network identifiers to their deployment arguments. Each network can have unique settings for the deployment. See {@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/NetworkArguments NetworkArguments}.
   * @param options - Optional settings for the deployment process. These can include various configurations specific to the deployment. See {@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/DeployOptions DeployOptions}.
   * @returns A Promise resolving to a Transaction object.
   *
   * @example
   * const networkArgs = {
   *    sepolia: {
   *      args: [ 18, "token" ],
   *    },
   *    goerli: { ... },
   * };
   * const options = {
   *    salt: "0xcafe00000000000000000000000000000000000000000000000000000000cafe",
   * };
   *
   * this.hre.multichain.deployMultichain("HelloContract", networkArgs, options);
   */
  public async deployMultichain<Abi extends ContractAbi = any>(
    contractName: string,
    networkArgs: NetworkArguments<Abi>,
    options?: DeployOptions
  ): Promise<DeployMultichainResponse> {
    const artifact = this.hre.artifacts.readArtifactSync(contractName);

    return this.deployMultichainBytecode(
      artifact.bytecode,
      artifact.abi as unknown as Abi,
      networkArgs,
      options
    );
  }

  /**
   * Deploys a contract using its bytecode and ABI to multiple blockchain networks.
   *
   * @param contractBytecode - The bytecode of the contract to be deployed. This is the compiled code of the contract.
   * @param contractAbi - The ABI of the contract. It defines the methods and structures used to interact with the binary contract.
   * @param networkArgs - An object mapping network identifiers to their deployment arguments. Each network can have unique settings for the deployment. See {@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/NetworkArguments NetworkArguments}.
   * @param options - Optional settings for the deployment process. These can include various configurations specific to the deployment. See {@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/DeployOptions DeployOptions}.
   * @returns A Promise resolving to a Transaction object.
   *
   * @example
   * const contractBytecode = "0x60a060405234801561001057600080fd5b5060405161052b38038061052b83...";
   * const contractAbi = [{ ... }, { ... }];
   *
   * const networkArgs = {
   *    sepolia: {
   *      args: [ 18, "token" ],
   *    },
   *    goerli: { ... },
   * };
   * const options = {
   *    salt: "0xcafe00000000000000000000000000000000000000000000000000000000cafe",
   * };
   *
   * this.hre.multichain.deployMultichainBytecode(contractBytecode, contractAbi, networkArgs, options);
   */
  public async deployMultichainBytecode<Abi extends ContractAbi = any>(
    contractBytecode: string,
    contractAbi: Abi,
    networkArgs: NetworkArguments<Abi>,
    options?: DeployOptions
  ): Promise<DeployMultichainResponse> {
    if (!this.isInitiated) await this.initConfig();

    //optional params
    const salt = options?.salt ?? utils.randomBytes(32);
    const isUniquePerChain = options?.isUniquePerChain ?? false;
    const adapterAddress = options?.adapterAddress ?? this.ADAPTER_ADDRESS;

    const { constructorArgs, initDatas, deployDomainIDs } = mapNetworkArgs(
      contractAbi,
      networkArgs,
      this.domains
    );

    const adapterContract = new this.web3.eth.Contract<typeof AdapterABI>(
      AdapterABI,
      adapterAddress
    );

    const fees = await adapterContract.methods
      .calculateDeployFee(
        contractBytecode,
        this.gasLimit,
        salt,
        isUniquePerChain,
        constructorArgs,
        initDatas,
        deployDomainIDs
      )
      .call();

    const [deployer] = await this.web3.eth.getAccounts();

    console.log("Sending transaction...");
    const receipt = await adapterContract.methods
      .deploy(
        contractBytecode,
        this.gasLimit,
        salt,
        isUniquePerChain,
        constructorArgs,
        initDatas,
        deployDomainIDs,
        fees
      )
      .send({
        from: deployer,
        value: sumedFees(fees),
        ...(options?.customNonPayableTxOptions || {}),
      });
    const networkNames = Object.keys(networkArgs);
    const { transactionHash } = receipt;
    console.log(
      `Multichain deployment initiated, transaction hash: ${transactionHash}` +
        "\n" +
        "Destinaton networks:\r\n" +
        networkNames.map((name) => ` - ${name}`).join("\r\n")
    );

    const destinationDomainChainIDs = deployDomainIDs.map((deployDomainID) => {
      const deployDomain: Domain = this.domains.find(
        (domain) => BigInt(domain.id) === deployDomainID
      )!;
      return deployDomain.chainId;
    });

    await Promise.all(
      destinationDomainChainIDs.map(async (domainChainID, index) => {
        const network = networkNames[index];

        const contractAddress = await adapterContract.methods
          .computeContractAddressForChain(
            deployer,
            salt,
            isUniquePerChain,
            domainChainID
          )
          .call();
        console.log(
          `Contract deploying on ${network.toUpperCase()}: ${contractAddress}`
        );
      })
    );

    return {
      transactionHash,
      domainIDs: deployDomainIDs,
    };
  }

  /**
   * Fetches and logs the deployment information for a smart contract deployed across multiple blockchain networks.
   * This function retrieves the status of a contract's deployment on each specified network domain using the transaction hash
   * obtained from the `deployMultichain` or `deployMultichainBytecode` function.
   *
   * @param transactionHash The hash of the transaction returned by `deployMultichain` or `deployMultichainBytecode`.
   * @param domainIDs An array of bigint values representing the domain IDs on which the contract was deployed. These IDs correspond
   *                  to the blockchain networks registered on Sygma and should match the ones used during the deployment process.
   *
   * @example
   * const { transactionHash, domainIDs } = await this.hre.multichain.deployMultichain("HelloContract", networkArgs);
   * await getDeploymentInfo(transactionHash, domainIDs);
   */
  public async getDeploymentInfo(
    transactionHash: string,
    domainIDs: bigint[]
  ): Promise<void> {
    const explorerUrl = await pollTransferStatusUntilResolved(
      this.hre.config.multichain.environment,
      transactionHash,
      domainIDs
    );

    console.log(`Bridge transfer executed. More details: ${explorerUrl}`);
  }
}
