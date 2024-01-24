import 'mocha'
import {assert, use} from "chai";
import chaiAsPromised from "chai-as-promised";

import { useEnvironment } from "./helpers";
import {Environment} from "@buildwithsygma/sygma-sdk-core";
import {getConfigEnvironmentVariable, getNetworkChainId} from "../src/utils";
import sinon, {SinonSandbox} from "sinon";
import {HttpProvider, Web3} from "web3";

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

    let sandbox: SinonSandbox;
    let web3Stub: sinon.SinonStubbedInstance<Web3>;

    beforeEach(() => {
      sandbox = sinon.createSandbox();

      const ethStub = { eth: { getChainId: sandbox.stub() } };

      // @ts-ignore
      web3Stub = sandbox.createStubInstance(Web3, ethStub);
      // @ts-ignore
      web3Stub.eth.getChainId.resolves(5);
    });

    afterEach(() => {
      sandbox.restore();
    });


    it("should work", async function () {
      const chainID = await getNetworkChainId("goerli", this.hre);

      console.log(chainID);
    });

    it("should work with http", async function () {
      const chainId = await getNetworkChainId('goerliNoChainId', this.hre);

      console.log(chainId)
    });
  });

  describe("mapNetworkArgs", function () {
    useEnvironment("hardhat-project");

    // TODO
  });
});
