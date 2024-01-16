import assert from "assert";
import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { Environment } from "@buildwithsygma/sygma-sdk-core";
import {
  Bytes,
  Contract,
  ContractAbi,
  ContractConstructorArgs,
  FMT_BYTES,
  FMT_NUMBER,
  HttpProvider,
  Numbers,
  Web3,
  utils,
} from "web3";

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

export function sumedFees(fees: Numbers[]): string {
  const sumOfFees = fees.reduce(
    (previous, current) => BigInt(previous) + BigInt(current),
    0
  );
  return sumOfFees.toString();
}

export function mapNetworkArgs<Abi extends ContractAbi = any>(
  artifact: Artifact,
  networkArgs: Record<
    string,
    {
      args: ContractConstructorArgs<Abi>;
      initData?: Bytes;
    }
  >
): { constructorArgs: string[]; initDatas: Bytes[] } {
  const { bytesToHex, hexToBytes } = utils;
  const contract = new Contract(artifact.abi);

  const constructorArgs: string[] = [];
  const initDatas: Bytes[] = [];

  Object.keys(networkArgs).map((networkName) => {
    const encodedDeployMethod = contract
      .deploy({
        data: artifact.bytecode,
        arguments: networkArgs[networkName].args,
      })
      .encodeABI();

    const argsInBytes = bytesToHex(
      hexToBytes(encodedDeployMethod).slice(
        hexToBytes(artifact.bytecode).length
      )
    );

    constructorArgs.push(argsInBytes);

    if (networkArgs[networkName].initData) {
      initDatas.push(networkArgs[networkName].initData as Bytes);
    } else {
      initDatas.push(hexToBytes("0x"));
    }
  });

  return {
    constructorArgs,
    initDatas,
  };
}
