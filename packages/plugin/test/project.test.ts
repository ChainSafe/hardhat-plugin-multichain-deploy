import "mocha";
import { assert, use } from "chai";
import chaiAsPromised from "chai-as-promised";

import { Environment } from "@buildwithsygma/sygma-sdk-core";
import { MultichainHardhatRuntimeEnvironmentField } from "../src/MultichainHardhatRuntimeEnvironmentField";

import { useEnvironment } from "./helpers";

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

    it("Should add the multichain.environment to the config", function () {
      assert.deepEqual(
        this.hre.config.multichain.environment,
        Environment.TESTNET
      );
    });
  });

  describe("Hardhat Runtime Environment extension", function () {
    useEnvironment("hardhat-project");
  });
});
