import 'mocha'
import { assert } from "chai";

import { MultichainHardhatRuntimeEnvironmentField } from "../src/MultichainHardhatRuntimeEnvironmentField";

import { useEnvironment } from "./helpers";

describe("Integration tests examples", function () {
  describe("Hardhat Runtime Environment extension", function () {
    useEnvironment("hardhat-project");

    it("Should add the multichain field", function () {
      assert.instanceOf(
        this.hre.multichain,
        MultichainHardhatRuntimeEnvironmentField
      );
    });

    it("The example field should say Deployed", function () {
      assert.equal(this.hre.multichain.deployMultichain(), "Deployed");
    });
  });

  describe("HardhatConfig extension", function () {
    useEnvironment("hardhat-project");

    it("Should add the multichain.deploymentNetworks to the config", function () {
      assert.deepEqual(
        this.hre.config.multichain.deploymentNetworks,
        ["hardhat"]
      );
    });
  });
});
