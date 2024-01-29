import {
  ContractAbi,
  ContractConstructorArgs,
  ContractMethods,
  MatchPrimitiveType,
  NonPayableCallOptions,
} from "web3";

export interface NetworkArguments<Abi extends ContractAbi = any> {
  [network: string]: {
    args?: ContractConstructorArgs<Abi>;
    initData?: {
      initMethodName: keyof ContractMethods<Abi>;
      //impossible to type unless we do something like this.getInitMethod(artifact, methodName).encode(args);
      initMethodArgs: unknown[];
    };
  };
}

export interface DeployOptions {
  salt?: MatchPrimitiveType<"bytes32", unknown>;
  isUniquePerChain?: boolean;
  customNonPayableTxOptions?: NonPayableCallOptions;
}

export interface DeploymentInfo {
  network: string;
  contractAddress: string;
  explorerUrl: string;
  transactionHash: string;
}
