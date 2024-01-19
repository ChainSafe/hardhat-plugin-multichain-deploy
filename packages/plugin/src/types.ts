import {
  ContractAbi,
  ContractConstructorArgs,
  MatchPrimitiveType,
  NonPayableCallOptions,
} from "web3";

/**
 * NetworkArgument
 * @property args - Indicates whether args is providing.
 * @property initData - Indicates whether the init data.
 */
interface NetworkArgument<Abi extends ContractAbi = any> {
  args: ContractConstructorArgs<Abi>;
  initData?: string;
}

/**
 * NetworkArguments
 * @property [network] - NetworkArgument
 */
export interface NetworkArguments<Abi extends ContractAbi = any> {
  [network: string]: NetworkArgument<Abi>;
}

/**
 * Options used for contract deployment
 *
 * @property [salt] - Indicates whether salt is present, as Uint8Array or HexString.
 * @property [isUniquePerChain] - Indicates whether contract address is uniq per deployment.
 * @property [customNonPayableTxOptions] - Indicates whether the Wisdom component is present.
 */
export interface DeployOptions {
  salt?: MatchPrimitiveType<"bytes32", unknown>;
  isUniquePerChain?: boolean;
  customNonPayableTxOptions?: NonPayableCallOptions;
}
