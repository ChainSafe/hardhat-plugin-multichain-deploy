import assert from "assert";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Environment } from "@buildwithsygma/sygma-sdk-core";
import { FMT_BYTES, FMT_NUMBER, HttpProvider, Web3 } from "web3";

export function getConfigEnvironmentVariable(
  hre: HardhatRuntimeEnvironment
): Environment {
  return hre.config.multichain.environment;
}

export async function getNetworkChainId(
  network: string,
  hre: HardhatRuntimeEnvironment
): Promise<number> {
  const networkConfig = hre.config.networks[network];
  let chainID = networkConfig.chainId;
  if (!chainID) {
    assert("httpHeaders" in networkConfig);
    const httpProvider = new HttpProvider(networkConfig.url, {
      providerOptions: { headers: networkConfig.httpHeaders },
    });
    const web3 = new Web3(httpProvider);
    chainID = await web3.eth.getChainId({
      number: FMT_NUMBER.NUMBER,
      bytes: FMT_BYTES.HEX,
    });
  }
  return chainID;
}

export function getDeploymentNetworks(
  hre: HardhatRuntimeEnvironment
): string[] {
  return hre.config.multichain.deploymentNetworks;
}
