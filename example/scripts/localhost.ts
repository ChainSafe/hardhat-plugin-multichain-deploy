import { multichain } from "hardhat";
import { NetworkArguments} from "@chainsafe/hardhat-plugin-multichain-deploy";

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = BigInt(currentTimestampInSeconds + 60);

  const { adapterAddress } = await multichain.initLocalEnvironment();

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

  await multichain.deployMultichain("Lock", networkArguments, { adapterAddress });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
