import "mocha";
import { assert, expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

import { Environment } from "@buildwithsygma/sygma-sdk-core";
import helloSygmaContract from "@chainsafe/hardhat-plugin-multichain-deploy-contracts/artifacts/contracts/mocks/HelloSygma.sol/HelloSygma";
import { HardhatPluginError } from "hardhat/plugins";
import {
  encodeInitData,
  getConfigEnvironmentVariable,
  getNetworkChainId,
  sumedFees,
} from "../src/utils";
import { createMockHttpProvider } from "./MockHttpProvider";
import { useEnvironment } from "./helpers";

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

    it("Retrieve chainID from node if is not available in config", async function () {
      const chainId = await getNetworkChainId(
        "goerliNoChainId",
        this.hre,
        createMockHttpProvider()
      );
      expect(chainId).to.equal(5);
    });
  });

  describe("sumedFees", function () {
    it("Sum's all available types and return current result", function () {
      const sum = sumedFees([4, BigInt(3), "2", "0x1"]);
      expect(sum).to.equal("10");
    });

    [
      { type: "Number", values: [5, 5, 5] },
      { type: "Bigint", values: [BigInt(5), BigInt(5), BigInt(5)] },
      { type: "String", values: ["5", "5", "5"] },
      { type: "HexString", values: ["0x5", "0x5", "0x5"] },
    ].forEach(({ type, values }) => {
      it(`Sum's values of type ${type} and return current value`, function () {
        const sum = sumedFees(values);
        expect(sum).to.equal("15");
      });
    });
  });

  describe("encodeInitData", function () {
    useEnvironment("hardhat-project");
    const { abi } = helloSygmaContract;

    it("Return current encoded data for specified method", function () {
      expect(encodeInitData(abi, "setName", ["Pepe"])).to.be.equal(
        "0xc47f0027000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045065706500000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Should fail on unexciting method", function () {
      assert.throw(
        () => {
          encodeInitData(abi, "nonExisting", ["GirlFriend"]);
        },
        HardhatPluginError,
        "InitMethod nonExisting not foud in ABI"
      );
    });
  });

  describe("mapNetworkArgs", function () {
    useEnvironment("hardhat-project");

    it("does works?", function () {
      assert.deepEqual({}, {});
    });

    it("does works?", function () {
      assert.deepEqual({}, {});
    });

    it("should fail?", function () {
      assert.throw(() => {}, Error, "text");
    });

    it("should fail?", function () {
      assert.throw(() => {}, Error, "text");
    });
  });
});
