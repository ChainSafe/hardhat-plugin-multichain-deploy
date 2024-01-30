import assert from "assert";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  Domain,
  Environment,
  getTransferStatusData,
} from "@buildwithsygma/sygma-sdk-core";
import {
  AbiFallbackFragment,
  Bytes,
  ContractAbi,
  FMT_BYTES,
  FMT_NUMBER,
  HttpProvider,
  Numbers,
  Web3,
  eth,
  utils,
} from "web3";
import { HardhatPluginError } from "hardhat/plugins";
import { NetworkArguments } from "./types";

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

export function sumedFees(fees: Numbers[]): string {
  const sumOfFees = fees.reduce(
    (previous, current) => BigInt(previous) + BigInt(current),
    0
  );
  return sumOfFees.toString();
}

export function encodeInitData<Abi extends ContractAbi>(
  abi: Abi,
  initMethodName: string,
  initMethodArgs: unknown[]
): Bytes {
  const initMethodAbiFragment = (
    abi as unknown as Array<AbiFallbackFragment>
  ).find((fragment) => fragment.name === initMethodName);
  if (!initMethodAbiFragment)
    throw new HardhatPluginError(
      "@chainsafe/hardhat-plugin-multichain-deploy",
      `InitMethod ${initMethodName} not foud in ABI`
    );

  return eth.abi.encodeFunctionCall(initMethodAbiFragment, initMethodArgs);
}

export function mapNetworkArgs<Abi extends ContractAbi = any>(
  contractAbi: Abi,
  networkArgs: NetworkArguments<Abi>,
  domains: Domain[]
): {
  deployDomainIDs: bigint[];
  constructorArgs: string[];
  initDatas: Bytes[];
} {
  const { hexToBytes } = utils;
  const deployDomainIDs: bigint[] = [];
  const constructorArgs: string[] = [];
  const initDatas: Bytes[] = [];

  Object.keys(networkArgs).map((networkName) => {
    //checks if destination networks name is valid
    const matchingDomain = domains.find(
      (domain) => domain.name === networkName
    );
    if (matchingDomain) deployDomainIDs.push(BigInt(matchingDomain.id));
    else {
      throw new HardhatPluginError(
        "@chainsafe/hardhat-plugin-multichain-deploy",
        `Unavailable Networks in networkArgs: The following network ${networkName} is not supported as destination network.
        Available networks: ${domains
          .map((domain): string => `${domain.name}`)
          .join(", ")
          .replace(/, ([^,]*)$/, "")}\n
        `
      );
    }

    const constructorAbi = contractAbi.filter(
      (f) => f.type === "constructor"
    )[0].inputs;
    const networkConstructorArgs = networkArgs[networkName].args;

    if (constructorAbi) {
      //throws if user did not provide constructor args for network
      if (!networkConstructorArgs)
        throw new HardhatPluginError(
          "@chainsafe/hardhat-plugin-multichain-deploy",
          `Contract ABI provided required constructor arguments for ${networkName}`
        );

      const argsInBytes = eth.abi.encodeParameters(
        constructorAbi,
        networkConstructorArgs
      );
      //provided constructorAbi with args
      constructorArgs.push(argsInBytes);
    } else {
      //throws if user provides args and none are in abi
      if (networkConstructorArgs)
        throw new HardhatPluginError(
          "@chainsafe/hardhat-plugin-multichain-deploy",
          `Contract ABI provided doesn't contain a constructor definition. 
            If provided contract should't have constructor, do not provide args parameter for ${networkName}.`
        );
      //no constructorAbi and no args
      constructorArgs.push("0x");
    }
    const networkInitData = networkArgs[networkName].initData;
    if (networkInitData !== undefined) {
      const { initMethodName, initMethodArgs } = networkInitData;
      const initData = encodeInitData(
        contractAbi,
        initMethodName,
        initMethodArgs
      );

      initDatas.push(initData);
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

export async function transferStatusInterval(
  environment: Environment,
  txHash: string,
  domainID: number
): Promise<string> {
  let explorerUrl: string = "";

  await new Promise((resolve) => {
    let controller: AbortController;
    setInterval(() => {
      controller = new AbortController();
      void getTransferStatusData(environment, txHash, domainID.toString()).then(
        (transferStatus) => {
          explorerUrl = transferStatus.explorerUrl;

          if (transferStatus.status === "executed") {
            controller.abort();
            resolve(explorerUrl);
          }
          if (transferStatus.status === "failed") {
            throw new HardhatPluginError(
              "@chainsafe/hardhat-plugin-multichain-deploy",
              `Bridge transfer failed`
            );
          }
        }
      );
    }, 1000);
  });

  return explorerUrl;
}
