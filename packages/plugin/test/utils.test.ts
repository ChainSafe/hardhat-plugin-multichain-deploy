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
  mapNetworkArgs,
  sumedFees,
} from "../src/utils";
import { NetworkArguments } from "../src/types";
import { createMockHttpProvider, mockDomains } from "./mocks";
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
    const { abi } = helloSygmaContract;

    it("Return current encoded data, without init data", function () {
      const networkArgs: NetworkArguments<typeof abi> = {
        goerli: { args: [5] },
        holesky: { args: [5] },
      };

      assert.deepEqual(mapNetworkArgs(abi, networkArgs, mockDomains), {
        deployDomainIDs: [BigInt(1), BigInt(6)],
        constructorArgs: [
          "0x0000000000000000000000000000000000000000000000000000000000000005",
          "0x0000000000000000000000000000000000000000000000000000000000000005",
        ],
        initDatas: [new Uint8Array(), new Uint8Array()],
      });
    });

    it("Return current encoded data, with init data", function () {
      const networkArgs: NetworkArguments<typeof abi> = {
        goerli: {
          args: [5],
          initData: { initMethodName: "setName", initMethodArgs: ["chain"] },
        },
        holesky: {
          args: [5],
          initData: { initMethodName: "setName", initMethodArgs: ["safe"] },
        },
      };

      assert.deepEqual(mapNetworkArgs(abi, networkArgs, mockDomains), {
        deployDomainIDs: [BigInt(1), BigInt(6)],
        constructorArgs: [
          "0x0000000000000000000000000000000000000000000000000000000000000005",
          "0x0000000000000000000000000000000000000000000000000000000000000005",
        ],
        initDatas: [
          "0xc47f002700000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000005636861696e000000000000000000000000000000000000000000000000000000",
          "0xc47f0027000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000047361666500000000000000000000000000000000000000000000000000000000",
        ],
      });
    });

    it("Return current encoded data, with mixed init data", function () {
      const networkArgs: NetworkArguments<typeof abi> = {
        goerli: { args: [5] },
        holesky: {
          args: [5],
          initData: { initMethodName: "setName", initMethodArgs: ["safe"] },
        },
      };

      assert.deepEqual(mapNetworkArgs(abi, networkArgs, mockDomains), {
        deployDomainIDs: [BigInt(1), BigInt(6)],
        constructorArgs: [
          "0x0000000000000000000000000000000000000000000000000000000000000005",
          "0x0000000000000000000000000000000000000000000000000000000000000005",
        ],
        initDatas: [
          new Uint8Array(),
          "0xc47f0027000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000047361666500000000000000000000000000000000000000000000000000000000",
        ],
      });
    });

    it("Should fail on missing domain", function () {
      const networkArgs: NetworkArguments<typeof abi> = {
        sepolia: {
          args: [5],
          initData: { initMethodName: "setName", initMethodArgs: ["chain"] },
        },
        goreli: {
          args: [5],
          initData: { initMethodName: "setName", initMethodArgs: ["safe"] },
        },
      };

      assert.throw(
        () => {
          mapNetworkArgs(abi, networkArgs, mockDomains);
        },
        HardhatPluginError,
        "Unavailable Networks in networkArgs"
      );
    });

    it("Should fail on missing wrong initMethodName", function () {
      const networkArgs: NetworkArguments<typeof abi> = {
        sepolia: {
          args: [5],
          initData: {
            initMethodName: "setLevel" as any /* Hack to bypass type-check */,
            initMethodArgs: ["22"],
          },
        },
        goreli: {
          args: [5],
          initData: { initMethodName: "setName", initMethodArgs: ["safe"] },
        },
      };

      assert.throw(
        () => {
          mapNetworkArgs(abi, networkArgs, mockDomains);
        },
        HardhatPluginError,
        "InitMethod setLevel not foud in ABI"
      );
    });
  });
});
