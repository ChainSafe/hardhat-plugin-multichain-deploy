import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { Config } from "@buildwithsygma/sygma-sdk-core";
import { HardhatPluginError } from "hardhat/plugins";
import Web3, {
  ContractConstructorArgs,
  ContractAbi,
  MatchPrimitiveType,
  Transaction,
  Bytes,
  utils,
  PayableCallOptions,
  NonPayableCallOptions,
} from "web3";
import {
  getConfigEnvironmentVariable,
  getDeploymentNetworks,
  getNetworkChainId,
  mapNetworkArgs,
  sumedFees,
} from "./utils";
import { AdapterABI } from "./adapterABI";

export class MultichainHardhatRuntimeEnvironmentField {
  private isValidated: boolean = false;
  private domainIds: number[] = [];
  private web3: Web3 | null;

  public constructor(private readonly hre: HardhatRuntimeEnvironment) {
    const provider = this.hre.network.provider;
    this.web3 = new Web3(provider);
  }

  public ADAPTER_ADDRESS = "0x85d62ad850b322152bf4ad9147bfbf097da42217";

  private async validateConfig(): Promise<void> {
    const originChainId = await getNetworkChainId(
      this.hre.network.name,
      this.hre
    );
    const environment = getConfigEnvironmentVariable(this.hre);

    const config = new Config();
    await config.init(originChainId, environment);
    const domainChainIds = config.getDomains().map(({ chainId }) => chainId);
    const domainIds = config.getDomains().map(({ id }) => id);
    this.domainIds = domainIds;

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

  private async estimateGas(web3: Web3, artifact: Artifact): Promise<bigint> {
    const Contract = new web3.eth.Contract(artifact.abi);
    const deployGasLimit = await Contract.deploy().estimateGas();
    const gasLimit = deployGasLimit * BigInt(1.4);
    return gasLimit;
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
   * @param contractName name of the contract
   * @param networkArgs record key is name of the deploymentNetwork, same as in config multichain.deploymentNetwork
   * @param args contract contructor args
   * @param initData optional encoded initilize method, can be encoded with encodeInitData
   * @param salt optional or generated by default from randombytes(32)
   * @param isUniquePerChain optional
   * @param customGasLimit optional gas limit for transaction, default is calculated in method
   * @param customNonPayableTxOptions non payable options for web3 deploy.method.send(), payable summed fees are always calculated by the method
   */
  public async deployMultichain<Abi extends ContractAbi = any>(
    contractName: string,
    networkArgs: Record<
      string,
      {
        args: ContractConstructorArgs<Abi>;
        initData?: string;
      }
    >,
    options?: {
      salt?: MatchPrimitiveType<"bytes32", unknown>;
      isUniquePerChain?: boolean;
      customGasLimit?: bigint;
      customNonPayableTxOptions?: NonPayableCallOptions;
    }
  ): Promise<Transaction | void> {
    if (!this.isValidated) await this.validateConfig();
    if (!this.web3) return;

    const artifact = this.hre.artifacts.readArtifactSync(contractName);

    //optional params
    const salt = options?.salt ?? utils.randomBytes(32);
    const isUniquePerChain = options?.isUniquePerChain ?? false;
    const gasLimit =
      options?.customGasLimit ?? (await this.estimateGas(this.web3, artifact));

    //adapter contract
    const adapterContract = new this.web3.eth.Contract(
      AdapterABI,
      this.ADAPTER_ADDRESS
    );

    const { constructorArgs, initDatas } = mapNetworkArgs(
      artifact,
      networkArgs
    );

    const deployBytecode = artifact.bytecode;
    const destinationDomainIDs = this.domainIds;

    const fees = await adapterContract.methods
      .calculateDeployFee(
        deployBytecode,
        gasLimit,
        salt,
        isUniquePerChain,
        constructorArgs,
        initDatas,
        destinationDomainIDs
      )
      .call();

    let payableTxOptions: PayableCallOptions = { value: sumedFees(fees) };

    if (options?.customNonPayableTxOptions) {
      payableTxOptions = {
        ...options.customNonPayableTxOptions,
        value: sumedFees(fees),
      };
    }

    const tx = await adapterContract.methods
      .deploy(
        deployBytecode,
        gasLimit,
        salt,
        isUniquePerChain,
        constructorArgs,
        initDatas,
        destinationDomainIDs,
        fees
      )
      .send(payableTxOptions);

    return tx;
  }
}
