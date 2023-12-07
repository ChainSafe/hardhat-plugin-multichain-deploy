import 'mocha'
import {assert, expect, use} from "chai";
import chaiAsPromised from "chai-as-promised";

import { MultichainHardhatRuntimeEnvironmentField } from "../src/MultichainHardhatRuntimeEnvironmentField";

import { useEnvironment } from "./helpers";
import {Environment} from "@buildwithsygma/sygma-sdk-core";

use(chaiAsPromised);

describe("Integration tests examples", function () {
  describe("Hardhat Runtime Environment extension", function () {
    useEnvironment("hardhat-project");

    it("Should add the multichain field", function () {
      assert.instanceOf(
        this.hre.multichain,
        MultichainHardhatRuntimeEnvironmentField
      );
    });
  });

  describe("HardhatConfig extension", function () {
    useEnvironment("hardhat-project");

    it("Should add the multichain.deploymentNetworks to the config", function () {
      assert.deepEqual(
        this.hre.config.multichain.deploymentNetworks,
        ["sepolia"]
      );
    });

    it("Should add the multichain.environment to the config", function () {
      assert.deepEqual(
        this.hre.config.multichain.environment,
        Environment.TESTNET
      );
    });
  });

  describe("Hardhat Runtime Environment extension", function () {
    useEnvironment("hardhat-project");

    it("The deployMultichain field should return 0x00", async function () {
      expect(
        await this.hre.multichain.deployMultichain('test', [])
      ).to.be.equal("0x00");
    });
  });
});
