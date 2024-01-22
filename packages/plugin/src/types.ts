import {
  ContractAbi,
  ContractConstructorArgs,
  MatchPrimitiveType,
  NonPayableCallOptions,
} from "web3";

export type DeploymentNetwork = "ethereum" | "sepolia" | "mumbai" | "goerli" | "holesky" | string;

export type NetworkArguments<Abi extends ContractAbi = any> = {
  [network in DeploymentNetwork]: {
    args: ContractConstructorArgs<Abi>;
    initData?: string;
  };
};

export interface DeployOptions {
  salt?: MatchPrimitiveType<"bytes32", unknown>;
  isUniquePerChain?: boolean;
  customNonPayableTxOptions?: NonPayableCallOptions;
}
