import {
  ContractAbi,
  ContractConstructorArgs,
  MatchPrimitiveType,
  NonPayableCallOptions,
} from "web3";

/**
 * NetworkArgument
 * @property {boolean} args - Indicates whether the Courage component is present.
 * @property {string} initData - Indicates whether the Power component is present.
 */
interface NetworkArgument<Abi extends ContractAbi = any> {
  args: ContractConstructorArgs<Abi>;
  initData?: string;
}

/**
 * NetworkArguments
 * @property {NetworkArgument} [network] - NetworkArgument
 */
export interface NetworkArguments<Abi extends ContractAbi = any> {
  [network: string]: NetworkArgument<Abi>;
}

/**
 * Options used for contract deployment
 *
 * @property {Uint8Array | string} [salt] - Indicates whether the Courage component is present.
 * @property {Boolean} [isUniquePerChain] - Indicates whether the Power component is present.
 * @property {NonPayableCallOptions} [customNonPayableTxOptions] - Indicates whether the Wisdom component is present.
 */
export interface DeployOptions {
  salt?: MatchPrimitiveType<"bytes32", unknown>;
  isUniquePerChain?: boolean;
  customNonPayableTxOptions?: NonPayableCallOptions;
}
