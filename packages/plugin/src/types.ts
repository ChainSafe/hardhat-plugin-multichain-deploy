import {
  ContractAbi,
  ContractConstructorArgs,
  ContractMethodInputParameters,
  MatchPrimitiveType,
  NonPayableCallOptions,
} from "web3";

export interface NetworkArguments<Abi extends ContractAbi = any> {
  [network: string]: {
    args?: ContractConstructorArgs<Abi>;
    initData?: {
      initMethodName: string;
      initMethodArgs: ContractMethodInputParameters<Abi>;
    };
  };
}

export interface DeployOptions {
  salt?: MatchPrimitiveType<"bytes32", unknown>;
  isUniquePerChain?: boolean;
  customNonPayableTxOptions?: NonPayableCallOptions;
}
