import { multichain, web3 } from "hardhat";
import { NetworkArguments } from "@chainsafe/hardhat-plugin-multichain-deploy";

async function main(): Promise<void> {
  // const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  // const unlockTime = BigInt(currentTimestampInSeconds + 1200);
  // const [deployer] = await web3.eth.getAccounts();

  const networkArguments: NetworkArguments = {
    sepolia: {
      args: [],
    },
    holesky: {
      args: [],
    },
  };

  const { transactionHash, domainIDs } = await multichain.deployMultichain(
    "Storage",
    networkArguments
  );

  await multichain.getDeploymentInfo(transactionHash, domainIDs);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
