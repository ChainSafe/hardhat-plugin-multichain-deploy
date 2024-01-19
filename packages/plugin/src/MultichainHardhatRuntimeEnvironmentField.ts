import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { Config, Domain } from "@buildwithsygma/sygma-sdk-core";
import { HardhatPluginError } from "hardhat/plugins";
import Web3, {
  ContractAbi,
  Transaction,
  Bytes,
  utils,
  PayableCallOptions,
} from "web3";
import {
  getConfigEnvironmentVariable,
  getDeploymentNetworks,
  getNetworkChainId,
  mapNetworkArgs,
  sumedFees,
} from "./utils";
import { AdapterABI } from "./adapterABI";
import { DeployOptions, NetworkArguments } from "./types";

export class MultichainHardhatRuntimeEnvironmentField {
  private isValidated: boolean = false;
  private domains: Domain[] = [];
  private readonly web3: Web3 | null;

  public constructor(private readonly hre: HardhatRuntimeEnvironment) {
    const provider = this.hre.network.provider;
    this.web3 = new Web3(provider);
  }

  public ADAPTER_ADDRESS = "0x85d62ad850b322152bf4ad9147bfbf097da42217";

  //current Sygma hardcoded gasLimit
  private gasLimit = 1000000;

  private async validateConfig(): Promise<void> {
    const originChainId = await getNetworkChainId(
      this.hre.network.name,
      this.hre
    );
    const environment = getConfigEnvironmentVariable(this.hre);

    const config = new Config();
    await config.init(originChainId, environment);

    this.domains = config.getDomains();
    const domainChainIds = this.domains.map(({ chainId }) => chainId);

    const deploymentNetworks = getDeploymentNetworks(this.hre);
    const deploymentNetworksInfo = await Promise.all(
      deploymentNetworks.map(async (name) => {
        const chainId = await getNetworkChainId(name, this.hre);
        return { name, chainId };
      })
    );

    const missedRoutes: typeof deploymentNetworksInfo = [];
    deploymentNetworksInfo.forEach(({ chainId, name }) => {
      if (!domainChainIds.includes(chainId))
        missedRoutes.push({ chainId, name });
    });
    if (missedRoutes.length)
      throw new HardhatPluginError(
        "@chainsafe/hardhat-plugin-multichain-deploy",
        `Unavailable Networks in Deployment: The following networks from 'deploymentNetworks' are not routed in Sygma for the '${environment}' environment: ${missedRoutes
          .map(({ chainId, name }) => `${name}(${chainId})`)
          .join(", ")
          .replace(/, ([^,]*)$/, " and $1")}\n` +
          `Please adjust your 'deploymentNetworks' to align with the supported routes in this environment. For details on supported networks, refer to the Sygma documentation.`
      );

    this.isValidated = true;
  }

  public static encodeInitData(
    artifact: Artifact,
    initMethodName: string,
    initMethodArgs: string[]
  ): Bytes {
    //TODO
    // const contract = new Contract(artifact.abi);
    // const encodedInitMethod = contract.methods[initMethodName](initMethodArgs).encodeABI();
    console.log(artifact, initMethodArgs, initMethodName);
    return utils.hexToBytes("0x");
  }

  /**
   * Deploys a contract to multiple blockchain networks.
   *
   * @param contractName - The name of the contract to be deployed.
   * @param networkArgs - An object mapping network identifiers to their deployment arguments. Each network can have unique settings for the deployment. See [NetworkArguments]{@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/NetworkArguments}.
   * @param options - Optional settings for the deployment process. These can include various configurations specific to the deployment. See [DeployOptions]{@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/DeployOptions}.
   * @returns A Promise resolving to a Transaction object or void.
   *
   * @example
   * // TODO
   */
  public async deployMultichain<Abi extends ContractAbi = any>(
    contractName: string,
    networkArgs: NetworkArguments<Abi>,
    options?: DeployOptions
  ): Promise<Transaction | void> {
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
   * @param contractAbi - The ABI (Application Binary Interface) of the contract. It defines the methods and structures used to interact with the binary contract.
   * @param networkArgs - An object mapping network identifiers to their deployment arguments. Each network can have unique settings for the deployment. See [NetworkArguments]{@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/NetworkArguments}.
   * @param options - Optional settings for the deployment process. These can include various configurations specific to the deployment. See [DeployOptions]{@link https://github.com/ChainSafe/hardhat-plugin-multichain-deploy/docs/plugin/DeployOptions}.
   * @returns A Promise resolving to a Transaction object or void.
   *
   * @example
   * // TODO: Add example usage
   */
  public async deployMultichainBytecode<Abi extends ContractAbi = any>(
    contractBytecode: string,
    contractAbi: Abi,
    networkArgs: NetworkArguments<Abi>,
    options?: DeployOptions
  ): Promise<Transaction | void> {
    if (!this.isValidated) await this.validateConfig();
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
      contractBytecode,
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

    return adapterContract.methods
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
  }
}
