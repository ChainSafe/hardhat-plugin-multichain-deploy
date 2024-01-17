import assert from "assert";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Domain, Environment } from "@buildwithsygma/sygma-sdk-core";
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
import { HardhatPluginError } from "hardhat/plugins";

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
  contractBytecode: string,
  contractAbi: Abi,
  networkArgs: Record<
    string,
    {
      args: ContractConstructorArgs<Abi>;
      initData?: Bytes;
    }
  >,
  domains: Domain[]
): {
  deployDomainIDs: bigint[];
  constructorArgs: string[];
  initDatas: Bytes[];
} {
  const { bytesToHex, hexToBytes } = utils;
  const contract = new Contract(contractAbi);

  const deployDomainIDs: bigint[] = [];
  const constructorArgs: string[] = [];
  const initDatas: Bytes[] = [];

  Object.keys(networkArgs).map((networkName) => {
    //checks if network args
    const matchingDomain = domains.find(
      (domain) => domain.name === networkName
    );
    if (matchingDomain) deployDomainIDs.push(BigInt(matchingDomain.id));
    else {
      throw new HardhatPluginError(
        "@chainsafe/hardhat-plugin-multichain-deploy",
        `Unavailable Networks in networkArgs: The following network ${networkName} is not supported as destination network.`
      );
    }

    const encodedDeployMethod = contract
      .deploy({
        data: contractBytecode,
        arguments: networkArgs[networkName].args,
      })
      .encodeABI();

    const argsInBytes = bytesToHex(
      hexToBytes(encodedDeployMethod).slice(hexToBytes(contractBytecode).length)
    );

    constructorArgs.push(argsInBytes);

    if (networkArgs[networkName].initData) {
      initDatas.push(networkArgs[networkName].initData as Bytes);
    } else {
      initDatas.push(hexToBytes("0x"));
    }
  });

  return {
    deployDomainIDs,
    constructorArgs,
    initDatas,
  };
}
