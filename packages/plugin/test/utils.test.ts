import 'mocha'
import {assert, expect, use} from "chai";
import chaiAsPromised from "chai-as-promised";

import { useEnvironment } from "./helpers";
import {Environment} from "@buildwithsygma/sygma-sdk-core";
import {getConfigEnvironmentVariable, getNetworkChainId, sumedFees} from "../src/utils";
import {createMockHttpProvider} from "./MockHttpProvider";

use(chaiAsPromised);

describe("Unit tests for utils", function () {
  describe("getConfigEnvironmentVariable", function () {
    useEnvironment("hardhat-project");

    it("Should return valid environment from config", function () {
      assert.deepEqual(
        getConfigEnvironmentVariable(this.hre),
        Environment.TESTNET
      );
    });
  });

  describe("getNetworkChainId", function () {
    useEnvironment("hardhat-project");

    it("Retrieve chainID from config", async function () {
      const chainId = await getNetworkChainId("goerli", this.hre);
      expect(chainId).to.equal(5);
    });

    it('Retrieve chainID from node if is not available in config', async function () {
      const chainId = await getNetworkChainId('goerliNoChainId', this.hre, createMockHttpProvider());
      expect(chainId).to.equal(5);
    });
  });

  describe("sumedFees", function () {
    it("Sum's all available types and return current result", function () {
      const sum = sumedFees([4, BigInt(3), '2', '0x1']);
      expect(sum).to.equal('10');
    });

    [
      { type: 'Number', values: [5, 5, 5] },
      { type: 'Bigint', values: [BigInt(5), BigInt(5), BigInt(5)] },
      { type: 'String', values: ['5', '5', '5'] },
      { type: 'HexString', values: ['0x5', '0x5', '0x5'] },
    ].forEach(({ type, values}) => {
      it(`Sum's values of type ${type} and return current value`, function () {
        const sum = sumedFees(values);
        expect(sum).to.equal('15');
      });
    })
  });

  describe("mapNetworkArgs", function () {
    useEnvironment("hardhat-project");

    // TODO
  });
});
