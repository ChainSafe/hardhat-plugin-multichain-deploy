import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Config, Domain } from "@buildwithsygma/sygma-sdk-core";
import Web3, { ContractAbi, utils, PayableCallOptions } from "web3";
import { vars } from "hardhat/config";
import {
  getConfigEnvironmentVariable,
  getNetworkChainId,
  sumedFees,
  transferStatusInterval,
  mapNetworkArgs,
} from "./utils";
import {
  AdapterABI,
  AdapterBytecode,
  CreateXABI,
  CreateXBytecode,
} from "./adapterABI";
import {
  DeployOptions,
  NetworkArguments,
  DeployMultichainResponse,
} from "./types";

export class MultichainHardhatRuntimeEnvironmentField {
  private isInitiated: boolean = false;
  private domains: Domain[] = [];
  private readonly web3: Web3;

  public constructor(private readonly hre: HardhatRuntimeEnvironment) {
    const provider = this.hre.network.provider;
    this.web3 = new Web3(provider);
  }

  public ADAPTER_ADDRESS = vars.get(
    "ADAPTER_ADDRESS",
    "0x85d62ad850b322152bf4ad9147bfbf097da42217"
  );
  public LOCAL_ADAPTER_ADDRESS = "";

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

    this.isInitiated;
  }

  public async initLocalEnvironment(): Promise<void> {
    const [deployer] = await this.web3.eth.getAccounts();

    const gasMultiplier = this.hre.network.name.includes("arbi") ? 10 : 1;
    const txOptionsAdapter = { gasLimit: 1900000 * gasMultiplier };
    const txOptionsCreateX = { gasLimit: 2700000 * gasMultiplier };

    const createX = new this.web3.eth.Contract(CreateXABI);
    const response = await createX
      .deploy({
        data: CreateXBytecode,
      })
      .send({ from: deployer, ...txOptionsCreateX });
    console.log(`CreateX locally deployed: ${response.options.address!}`);

    const deployerSalt = this.web3.utils.encodePacked(
      ["bytes", "bytes", "bytes"],
      [deployer, "0x00", "0x0000000000000000000000"]
    );

    const receipt = await createX.methods
      .deployCreate3(deployerSalt, AdapterBytecode)
      .send({ from: deployer, ...txOptionsAdapter });

    const adapterAddress = receipt.events!.ContractCreation.returnValues
      .newContract as string;

    this.LOCAL_ADAPTER_ADDRESS = adapterAddress;

    console.log(
      `Adapter locally deployed: ${adapterAddress}` +
        "\n" +
        "Local environment initiated"
    );
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

    let payableTxOptions: PayableCallOptions = { value: sumedFees(fees) };

    if (options?.customNonPayableTxOptions) {
      payableTxOptions = {
        ...options.customNonPayableTxOptions,
        value: sumedFees(fees),
      };
    }
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
      .send(payableTxOptions);
    const networkNames = Object.keys(networkArgs);
    const { transactionHash } = receipt;
    console.log(
      `Multichain deployment initiated, transaction hash: ${transactionHash}` +
        "\n" +
        "Destinaton networks:" +
        networkNames.join("\r\n")
    );

    const [deployer] = await this.web3.eth.getAccounts();

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
    await Promise.all(
      domainIDs.map(async (domainId): Promise<void> => {
        const explorerUrl = await transferStatusInterval(
          this.hre.config.multichain.environment,
          transactionHash,
          domainId
        );

        console.log(`Bridge transfer executed. More details: ${explorerUrl}`);
      })
    );
  }
}
