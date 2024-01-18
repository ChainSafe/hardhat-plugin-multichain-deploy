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
   * deployMultichain deploy contract to multiple chains
   *
   * @param contractName - Name of contract developed in project
   * @param networkArgs - object of network's with arguments where will be deployed, for more information check {@link NetworkArguments}
   * @param [options] - Additional options that can be provided into deployer, for more information check {@link DeployOptions}
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
   * @param contractBytecode - bytecode of contract
   * @param contractAbi - abi of that contract
   * @param networkArgs - record key is name of the networks on which contract is being deployed {@link NetworkArguments}
   * @param [options] - Additional options that can be provided into method {@link DeployOptions}
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
