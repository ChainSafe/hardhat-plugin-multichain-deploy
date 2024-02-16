import { multichain } from "hardhat";
import { NetworkArguments } from "@chainsafe/hardhat-plugin-multichain-deploy";

async function main(): Promise<void> {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = BigInt(currentTimestampInSeconds + 60);

  const networkArguments: NetworkArguments = {
    sepolia: {
      args: [unlockTime],
      initData: {
        initMethodName: "setName",
        initMethodArgs: ["sepolia"],
      },
    },
    mumbai: {
      args: [unlockTime],
      initData: {
        initMethodName: "setName",
        initMethodArgs: ["mumbai"],
      },
    },
    holesky: {
      args: [unlockTime],
      initData: {
        initMethodName: "setName",
        initMethodArgs: ["holesky"],
      },
    },
  };

  const { transactionHash, domainIDs } = await multichain.deployMultichain(
    "Lock",
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
