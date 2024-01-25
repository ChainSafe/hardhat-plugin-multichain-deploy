import {HttpProvider} from "web3";

// TODO: Refactor to be reusable... and maybe add sinon
export function createMockHttpProvider(): typeof HttpProvider {
  return MockHttpProvider as unknown as typeof HttpProvider;
}

class MockHttpProvider {
  async request(payload: { method: string; }) {
    if (payload.method === 'eth_chainId') {
      return {"jsonrpc": "2.0", "id": 1, "result": "0x5"}; // Example chain ID in hex format
    }
  }
}
