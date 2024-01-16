import crypto from "crypto";
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

  public constructor(private readonly hre: HardhatRuntimeEnvironment) {}

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

  public async deployMultichain<Abi extends ContractAbi = any>(
    name: string,
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
    }
  ): Promise<Transaction> {
    if (!this.isValidated) await this.validateConfig();

    const artifact = this.hre.artifacts.readArtifactSync(name);
    const provider = this.hre.network.provider;

    //web3
    const web3 = new Web3(provider);

    //optional params
    const salt = options?.salt ?? crypto.randomBytes(32).toString("hex");
    const isUniquePerChain = options?.isUniquePerChain ?? false;

    //adapter contract
    const adapterContract = new web3.eth.Contract(
      AdapterABI,
      this.ADAPTER_ADDRESS
    );

    const gasLimit = await this.estimateGas(web3, artifact);

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
      .send({ value: sumedFees(fees) });
    return tx;
  }
}
