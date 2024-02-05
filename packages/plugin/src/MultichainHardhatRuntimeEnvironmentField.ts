import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Config, Domain } from "@buildwithsygma/sygma-sdk-core";
import Web3, {
  ContractAbi,
  Transaction,
  utils,
  PayableCallOptions,
} from "web3";
import { vars } from "hardhat/config";
import {
  getConfigEnvironmentVariable,
  getNetworkChainId,
  sumedFees,
  transferStatusInterval,
  mapNetworkArgs,
} from "./utils";
import { AdapterABI } from "./adapterABI";
import { DeployOptions, DeploymentInfo, NetworkArguments } from "./types";

export class MultichainHardhatRuntimeEnvironmentField {
  private isInitiated: boolean = false;
  private domains: Domain[] = [];
  private readonly web3: Web3 | null;

  public constructor(private readonly hre: HardhatRuntimeEnvironment) {
    const provider = this.hre.network.provider;
    this.web3 = new Web3(provider);
  }

  public ADAPTER_ADDRESS = vars.get(
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

    this.isInitiated;
  }

  /**
   * Deploys a contract to multiple blockchain networks.
   *
   * @param contractName - The name of the contract to be deployed.
   * @param networkArgs - An object mapping network identifiers to their deployment arguments. Each network can have unique settings for the deployment. See {@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/NetworkArguments NetworkArguments}.
   * @param options - Optional settings for the deployment process. These can include various configurations specific to the deployment. See {@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/DeployOptions DeployOptions}.
   * @returns A Promise resolving to a Transaction object or void.
   *
   * @example
   * ```
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
   * ```
   */
  public async deployMultichain<Abi extends ContractAbi = any>(
    contractName: string,
    networkArgs: NetworkArguments<Abi>,
    options?: DeployOptions
  ): Promise<{
    deploymentInfo: DeploymentInfo[];
    receipt: Transaction;
  } | void> {
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
   * @returns A Promise resolving to a Transaction object or void.
   *
   * @example
   * ```
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
   * this.hre.multichain.deployMultichain(contractBytecode, contractAbi, networkArgs, options);
   * ```
   */
  public async deployMultichainBytecode<Abi extends ContractAbi = any>(
    contractBytecode: string,
    contractAbi: Abi,
    networkArgs: NetworkArguments<Abi>,
    options?: DeployOptions
  ): Promise<{
    deploymentInfo: DeploymentInfo[];
    receipt: Transaction;
  } | void> {
    if (!this.isInitiated) await this.initConfig();
    if (!this.web3) return;

    //optional params
    const salt = options?.salt ?? utils.randomBytes(32);
    const isUniquePerChain = options?.isUniquePerChain ?? false;

    //adapter contract
    const adapterContract = new this.web3.eth.Contract<typeof AdapterABI>(
      AdapterABI,
      this.ADAPTER_ADDRESS
    );

    const { constructorArgs, initDatas, deployDomainIDs } = mapNetworkArgs(
      contractAbi,
      networkArgs,
      this.domains
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
      `Multichain deployment initiated, transaction hash: ${transactionHash}
      
      ` +
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

    const deploymentInfo: DeploymentInfo[] = await Promise.all(
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

        const explorerUrl = await transferStatusInterval(
          this.hre.config.multichain.environment,
          transactionHash,
          domainChainID
        );

        console.log(`Bridge transfer executed. More details: ${explorerUrl}`);

        return {
          network,
          contractAddress,
          explorerUrl,
          transactionHash,
        };
      })
    );

    return {
      receipt,
      deploymentInfo,
    };
  }
}
