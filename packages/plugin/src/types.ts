import {
  ContractAbi,
  ContractConstructorArgs,
  ContractMethods,
  MatchPrimitiveType,
  NonPayableCallOptions,
} from "web3";

export type DeploymentNetwork =
  | "ethereum"
  | "sepolia"
  | "mumbai"
  | "goerli"
  | "holesky"
  | string;

export type NetworkArguments<Abi extends ContractAbi = any> = {
  [network in DeploymentNetwork]: {
    args: ContractConstructorArgs<Abi>;
    initData?: {
      initMethodName: keyof ContractMethods<Abi>;
      //impossible to type unless we do something like this.getInitMethod(artifact, methodName).encode(args);
      initMethodArgs: unknown[];
    };
  };
};

export interface DeployOptions {
  salt?: MatchPrimitiveType<"bytes32", unknown>;
  isUniquePerChain?: boolean;
  customNonPayableTxOptions?: NonPayableCallOptions;
}
