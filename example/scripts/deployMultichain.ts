import { multichain, web3 } from "hardhat";
import { NetworkArguments } from "@chainsafe/hardhat-plugin-multichain-deploy";

async function main(): Promise<void> {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = BigInt(currentTimestampInSeconds + 60);
  // Log the unlockTime for reference
  console.log("Deploying with unlockTime (UNIX timestamp):", unlockTime.toString());

  const [deployer] = await web3.eth.getAccounts();

  const networkArguments: NetworkArguments = {
    sepolia: {
      args: [deployer, unlockTime],
      initData: {
        initMethodName: "setName",
        initMethodArgs: ["sepolia"],
      },
    },
    mumbai: {
      args: [deployer, unlockTime],
      initData: {
        initMethodName: "setName",
        initMethodArgs: ["mumbai"],
      },
    },
    holesky: {
      args: [deployer, unlockTime],
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

  // Optionally, log the transactionHash and domainIDs for reference
  console.log("Deployment transaction hash:", transactionHash);
  console.log("Deployed domain IDs:", domainIDs);

  await multichain.getDeploymentInfo(transactionHash, domainIDs);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
