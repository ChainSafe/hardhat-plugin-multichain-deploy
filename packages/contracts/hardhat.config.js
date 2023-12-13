require("@nomicfoundation/hardhat-toolbox");
require("@chainsafe/hardhat-ts-artifact-plugin");
require("hardhat-docgen");
require("dotenv").config();

const sleep = (msec) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), msec);
  });
}

const isSet = (param) => {
  return param && param.length > 0;
}

const assert = (condition, message) => {
  if (condition) return;
  throw new Error(message);
}

const deploy = async (contractName, signer, ...params) => {
  const factory = await ethers.getContractFactory(contractName);
  const instance = await factory.connect(signer).deploy(...params);
  await instance.waitForDeployment();
  console.log(`Deploy ${contractName}: ${instance.target}`);
  return instance;
};

const getDeployBytecode = async (contractName, ...params) => {
  const factory = await ethers.getContractFactory(contractName);
  const tx = await factory.getDeployTransaction(...params);
  return tx.data;
};

const deployWithCreate3 = async (contractName, signer, createX, salt, ...params) => {
  const bytecode = await getDeployBytecode(contractName, ...params);
  const deployerSalt = ethers.concat([signer.address, "0x00", salt]);
  const receipt = await (await createX["deployCreate3(bytes32,bytes)"](deployerSalt, bytecode)).wait();
  const instance = await ethers.getContractAt(contractName, receipt.logs[1].args[0]);
  console.log(`Create3 ${contractName}: ${instance.target}`);
  return instance;
};

task("deploy", "Deploys CrosschainDeployAdapter on selected network")
.addOptionalParam("verify", "Verify the deployed adapter", "false", types.bool)
.setAction(async ({ verify }) => {
  let [deployer] = await ethers.getSigners();
  const createX = process.env.CREATEX;
  const salt = isSet(process.env.SALT) ? process.env.SALT : "0x0000000000000000000000";
  const resourceId = process.env.RESOURCE_ID;

  const bridge = process.env[`${network.name.toUpperCase()}_BRIDGE`];

  assert(ethers.isHexString(salt, 11), "Invalid salt, must be 0x prefixed hex 11 bytes.");
  assert(ethers.isHexString(resourceId, 32), "Invalid resource ID, must be 0x prefixed hex 32 bytes.");
  assert(ethers.isAddress(bridge), "Invalid bridge address.");

  const gasMultiplier = network.name.includes("arbi") ? 10 : 1;
  let factory;
  if (ethers.isAddress(createX)) {
    factory = await ethers.getContractAt("ICreateX", createX);
  } else {
    assert((await deployer.getNonce()) == 0, "Deployer has to have 0 nonce to deploy CreateX");
    factory = await deploy("CreateX", deployer, { gasLimit: 2700000 * gasMultiplier });
  }

  const adapter = await deployWithCreate3(
    "CrosschainDeployAdapter",
    deployer,
    factory,
    salt,
    factory.target,
    bridge,
    resourceId,
    { gasLimit: 1800000 * gasMultiplier }
  );

  if (verify === "true") {
    console.log("Waiting half a minute to start verification");
    await sleep(30000);
    await hre.run("verify:verify", {
      address: adapter.target,
      constructorArguments: [factory.target, bridge, resourceId],
    });
  }
});

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: { enabled: true, runs: 999999 },
          evmVersion: "paris",
        },
      },
      {
        version: "0.8.23", // Configuration to match that of CreateX project.
        settings: {
          optimizer: { enabled: true, runs: 999999 },
          evmVersion: "paris", // Prevent using the `PUSH0` opcode
          metadata: {
            bytecodeHash: "none", // Remove the metadata hash from the bytecode
          },
        },
      },
    ],
  },
  networks: {
    sepolia: {
      chainId: 11155111,
      url: process.env.SEPOLIA_URL || "",
      accounts:
        isSet(process.env.PRIVATE_KEY) ? [process.env.PRIVATE_KEY] : [],
    },
    mumbai: {
      chainId: 80001,
      url: process.env.MUMBAI_URL || "",
      accounts:
        isSet(process.env.PRIVATE_KEY) ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  docgen: {
    path: "./docs",
    clear: true,
    runOnCompile: false,
  },
  gasReporter: {
    enabled: isSet(process.env.REPORT_GAS),
    currency: "USD",
  },
  mocha: {
    timeout: 100000,
  },
};
