import { multichain } from "hardhat";
import { NetworkArguments } from "@chainsafe/hardhat-plugin-multichain-deploy";

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = BigInt(currentTimestampInSeconds + 60);

  const networkArguments = ['sepolia', 'mumbai', 'holesky'].reduce((args, networkName) => {
    args[networkName] = {
      args: [unlockTime],
      initData: {
        initMethodName: "setName",
        initMethodArgs: [networkName]
      }
      };
    return args;
  }, {} as NetworkArguments);

  const { transactionHash, domainIDs } = await multichain.deployMultichain("Lock", networkArguments);

  await multichain.getDeploymentInfo(transactionHash, domainIDs);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
