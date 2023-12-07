import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Config } from "@buildwithsygma/sygma-sdk-core";
import { HardhatPluginError } from "hardhat/plugins";
import { ContractConstructorArgs, ContractAbi } from "web3";
import {
  getConfigEnvironmentVariable,
  getDeploymentNetworks,
  getNetworkChainId,
} from "./utils";

export class MultichainHardhatRuntimeEnvironmentField {
  private isValidated: boolean = false;

  public constructor(private readonly hre: HardhatRuntimeEnvironment) {}

  private async validateConfig(): Promise<void> {
    const originChainId = await getNetworkChainId(
      this.hre.network.name,
      this.hre
    );
    const environment = getConfigEnvironmentVariable(this.hre);

    const config = new Config();
    await config.init(originChainId, environment);
    const domainChainIds = config.getDomains().map(({ chainId }) => chainId);

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

  public async deployMultichain<Abi extends ContractAbi>(
    nameOrBytecode: string,
    args: ContractConstructorArgs<Abi>,
    options?: Object
  ): Promise<string> {
    if (!this.isValidated) await this.validateConfig();

    const bytcode = await this.hre.artifacts
      .readArtifact(nameOrBytecode)
      .then((artifact) => artifact.bytecode)
      .catch(() => nameOrBytecode);

    // temp to silence eslint
    console.log(args, options, bytcode);

    return "0x00";
  }
}
