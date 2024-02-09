import "mocha";
import { assert, use } from "chai";
import chaiAsPromised from "chai-as-promised";

import { Environment, Network } from "@buildwithsygma/sygma-sdk-core";
import HelloSygma from "@chainsafe/hardhat-plugin-multichain-deploy-contracts/artifacts/contracts/mocks/HelloSygma.sol/HelloSygma";
import { MultichainHardhatRuntimeEnvironmentField } from "../src/MultichainHardhatRuntimeEnvironmentField";

import { DeployedLocalEnvironmentContracts } from "../src/types";
import { useEnvironment, useHardhatNode } from "./helpers";

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

  describe("Hardhat Runtime Environment extension - initLocalEnvironment", function () {
    useEnvironment("hardhat-localhost");
    useHardhatNode();

    it("Should deploy all required contracts on testnet", async function () {
      const addresses = await this.hre.multichain.initLocalEnvironment();

      assert.deepEqual(addresses, {
        adapterAddress: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        createXAddress: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        bridgeAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        feeHandlerAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      });
    });
  });

  describe("Hardhat Runtime Environment extension - deploy methods", function () {
    useEnvironment("hardhat-localhost");
    useHardhatNode();

    let addresses: DeployedLocalEnvironmentContracts;

    beforeEach(async function () {
      addresses = await this.hre.multichain.initLocalEnvironment();

      /* Manually set domains for testing purposes */
      // @ts-ignore
      this.hre.multichain.domains = [
        {
          id: 1,
          chainId: 69,
          name: "hardhat",
          type: Network.EVM,
        },
      ];
      // @ts-ignore
      this.hre.multichain.isInitiated = true;
    });

    it("Should successfully run deployMultichainBytecode", async function () {
      const tx = await this.hre.multichain.deployMultichainBytecode(
        HelloSygma.bytecode,
        HelloSygma.abi,
        {
          hardhat: {
            args: ["1"],
            initData: {
              initMethodName: "setName",
              initMethodArgs: ["Hell-o"],
            },
          },
        },
        { adapterAddress: addresses.adapterAddress }
      );
      assert.exists(tx.transactionHash);
    });
  });
});
