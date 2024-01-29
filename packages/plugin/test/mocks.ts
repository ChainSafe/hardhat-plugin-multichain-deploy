import { HttpProvider } from "web3";
import { Domain, Network } from "@buildwithsygma/sygma-sdk-core";

// TODO: Refactor to be reusable... and maybe add sinon
export function createMockHttpProvider(): typeof HttpProvider {
  return MockHttpProvider as unknown as typeof HttpProvider;
}

class MockHttpProvider {
  async request(payload: { method: string }) {
    if (payload.method === "eth_chainId") {
      return { jsonrpc: "2.0", id: 1, result: "0x5" }; // Example chain ID in hex format
    }
  }
}

export const mockDomains: Domain[] = [
  {
    id: 1,
    chainId: 5,
    name: "goerli",
    type: Network.EVM,
  },
  {
    id: 2,
    chainId: 11155111,
    name: "sepolia",
    type: Network.EVM,
  },
  {
    id: 6,
    chainId: 17000,
    name: "holesky",
    type: Network.EVM,
  },
  {
    id: 7,
    chainId: 80001,
    name: "mumbai",
    type: Network.EVM,
  },
];
