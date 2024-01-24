import 'mocha'
import {assert, expect, use} from "chai";
import chaiAsPromised from "chai-as-promised";

import { useEnvironment } from "./helpers";
import {Environment} from "@buildwithsygma/sygma-sdk-core";
import {getConfigEnvironmentVariable, getNetworkChainId} from "../src/utils";
import sinon from "sinon";

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
    let sandbox: sinon.SinonSandbox;

    beforeEach(function () {
      sandbox = sinon.createSandbox();
    });

    afterEach(function () {
      sandbox.restore();
    });


    it("should work", async function () {
      const chainID = await getNetworkChainId("goerli", this.hre);

      console.log(chainID);
    });

    it('should fetch the chain ID using a mocked HttpProviderClass', async function () {
      class MockHttpProvider {
        // @ts-ignore
        constructor(clientUrl, httpProviderOptions) {}

        // @ts-ignore
        async request(payload, requestOptions) {
          console.log("MockHttpProvider", payload, requestOptions);

          if (payload.method === 'eth_chainId') {
            return {"jsonrpc":"2.0","id":1,"result":"0x5"}; // Example chain ID in hex format
          }
        }
      }

      // @ts-ignore
      const chainId = await getNetworkChainId('goerliNoChainId', this.hre, MockHttpProvider);
      expect(chainId).to.equal(5);
    });
  });

  describe("mapNetworkArgs", function () {
    useEnvironment("hardhat-project");

    // TODO
  });
});
