require("@nomicfoundation/hardhat-web3-v4");
require("@chainsafe/hardhat-ts-artifact-plugin");
require("hardhat-docgen");
require("dotenv").config();
const { hexToBytes, bytesToHex, fromWei, isHexStrict, isAddress } = require("web3").utils;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

const getContractAt = (contractName, address, from) => {
  const artifact = artifacts.readArtifactSync(contractName);
  const contract = new web3.eth.Contract(artifact.abi, address, { from });
  return contract;
};

const deploy = async (contractName, signer, txParams, ...params) => {
  const artifact = artifacts.readArtifactSync(contractName);
  const contract = new web3.eth.Contract(artifact.abi);
  const response = await contract.deploy({
    data: artifact.bytecode,
    arguments: params,
  }).send({ from: signer, ...txParams });
  response.options.from = signer;
  return response;
};

const getDeployBytecode = async (contractName, ...params) => {
  const tx = await getBytecodeAndConstructorArgs(contractName, ...params);
  return tx.data;
};

const getBytecodeAndConstructorArgs = async (contractName, ...params) => {
  const artifact = artifacts.readArtifactSync(contractName);
  const contract = new web3.eth.Contract(artifact.abi);
  const data = await contract.deploy({
    data: artifact.bytecode,
    arguments: params,
  }).encodeABI();
  return {
    bytecode: artifact.bytecode,
    args: bytesToHex(hexToBytes(data).slice(hexToBytes(artifact.bytecode).length)),
    data,
  };
};

const getPureBytecode = async (contractName) => {
  const artifact = artifacts.readArtifactSync(contractName);
  return artifact.bytecode;
};

const deployWithCreate3 = async (contractName, signer, createX, salt, txParams, ...params) => {
  const bytecode = await getDeployBytecode(contractName, ...params);
  const deployerSalt = encodePacked(["bytes", "bytes", "bytes"], [signer, "0x00", salt]);
  const receipt = await createX.methods["deployCreate3(bytes32,bytes)"](deployerSalt, bytecode).send({from: signer, ...txParams});
  const instance = getContractAt(contractName, receipt.events.ContractCreation.returnValues.newContract, signer);
  console.log(`Create3 ${contractName}: ${instance.options.address}`);
  return instance;
};

const encodePacked = (types, values) => {
  const input = types.map((el, index) => ({type: el, value: values[index]}));
  return web3.utils.encodePacked(...input);
};

task("deploy", "Deploys CrosschainDeployAdapter on selected network")
.addOptionalParam("verify", "Verify the deployed adapter", "false", types.bool)
.setAction(async ({ verify }) => {
  const [deployer] = await web3.eth.getAccounts();
  const createX = process.env.CREATEX;
  const salt = isSet(process.env.SALT) ? process.env.SALT : "0x0000000000000000000000";
  const resourceId = process.env.RESOURCE_ID;

  const bridge = process.env[`${network.name.toUpperCase()}_BRIDGE`];

  assert(isHexStrict(salt) && hexToBytes(salt).length == 11, "Invalid salt, must be 0x prefixed hex 11 bytes.");
  assert(isHexStrict(resourceId) && hexToBytes(resourceId).length == 32, "Invalid resource ID, must be 0x prefixed hex 32 bytes.");
  assert(isAddress(bridge), "Invalid bridge address.");

  const gasMultiplier = network.name.includes("arbi") ? 10 : 1;
  let factory;
  if (isAddress(createX)) {
    factory = getContractAt("ICreateX", createX, deployer);
  } else {
    assert((await web3.eth.getTransactionCount(deployer)) == 0, "Deployer has to have 0 nonce to deploy CreateX");
    factory = await deploy("CreateX", deployer, { gasLimit: 2700000 * gasMultiplier });
  }

  const adapter = await deployWithCreate3(
    "CrosschainDeployAdapter",
    deployer,
    factory,
    salt,
    { gasLimit: 1900000 * gasMultiplier },
    factory.options.address,
    bridge,
    resourceId,
  );

  if (verify === "true") {
    console.log("Waiting half a minute to start verification");
    await sleep(30000);
    await hre.run("verify:verify", {
      address: adapter.options.address,
      constructorArguments: [factory.options.address, bridge, resourceId],
    });
  }
});

task("crosschain-deploy", "Deploys a contract across different chains using the CrosschainDeployAdapter")
.addParam("contractname", "Contract to deploy")
.addParam("destinationdomains", "Comma separated destination domain IDs") // Sepolia is 2, Mumbai is 7
.addOptionalParam("constructorarguments", "Comma separated constructor args for each domain", "")
.addOptionalParam("initfunctions", "Comma separated init functions for each domain", "")
.addOptionalParam("initarguments", "Comma separated init args for each domain", "")
.addOptionalParam("gaslimit", "Crosschain deployment gas limit", "1000000")
.addOptionalParam("salt", "Crosschain deployment salt hex 32 bytes", "0x0000000000000000000000000000000000000000000000000000000000000000")
.addOptionalParam("unique", "Should the address be unique on every chain (true), or the same (false)", "false", types.bool)
.addOptionalParam("verify", "Verify the deployed contract on current network", "false", types.bool)
.setAction(async ({ contractname, destinationdomains, constructorarguments,
  initfunctions, initarguments, gaslimit, salt, unique, verify }) => {
  const [deployer] = await web3.eth.getAccounts();
  const dest = destinationdomains.split(",");
  assert(dest.length > 0, "Empty destination domains list");
  const isUnique = unique == "true";
  assert(isHexStrict(salt) && hexToBytes(salt).length == 32, "Invalid salt, must be 0x prefixed hex 32 bytes.");

  const adapterAddress = process.env.ADAPTER;
  assert(isAddress(adapterAddress), "Invalid adapter address in the ENV.");
  const adapter = getContractAt("CrosschainDeployAdapter", adapterAddress, deployer);

  const predictedAddress = await adapter.methods.computeContractAddress(deployer, salt, isUnique).call();
  assert(await web3.eth.getCode(predictedAddress) == "0x", "Salt already used with this deployer");

  const IContract = getContractAt(contractname, ZERO_ADDRESS, deployer);
  const initFuncs = initfunctions.split(",");
  if (initFuncs.length > 0) {
    assert(initFuncs.length == dest.length, "Invalid number of init functions.");
  }
  const initArgs = initarguments.split(",");
  assert(initArgs.length % dest.length == 0, "Invalid init arguments number");
  const argsPerFunc = initArgs.length / dest.length;
  const initData = [];
  for (let i = 0; i < initFuncs.length; i++) {
    const initTx = await IContract.methods[initFuncs[i]](
      ...(initArgs.slice(i * argsPerFunc, (i + 1) * argsPerFunc))
    ).encodeABI();
    initData.push(initTx);
  }
  const constructorArgs = constructorarguments.split(",");
  assert(constructorArgs.length % dest.length == 0, "Invalid constructor arguments number");
  const argsPerConstructor = constructorArgs.length / dest.length;
  const constructorData = [];
  for (let i = 0; i < initFuncs.length; i++) {
    const constructorTx = await getBytecodeAndConstructorArgs(
      contractname,
      ...(constructorArgs.slice(i * argsPerConstructor, (i + 1) * argsPerConstructor))
    );
    constructorData.push(constructorTx.args);
  }
  const bytecode = await getPureBytecode(
    contractname,
  );
  const fees = await adapter.methods.calculateDeployFee(
    bytecode,
    gaslimit,
    salt,
    isUnique,
    constructorData,
    initData,
    dest,
  ).call();
  const totalFee = fees.reduce((total, next) => total + next, 0n);

  console.log("Crosschain deploy fee:", fromWei(totalFee, "ether"));
  const tx = await adapter.methods.deploy(
    bytecode,
    gaslimit,
    salt,
    isUnique,
    constructorData,
    initData,
    dest,
    fees.map(el => el),
  ).send({value: totalFee});

  const deployed = tx.events.Deployed;
  if (deployed) {
    console.log(`${contractname} deployed on ${isUnique ? "current" : "every"} network to:`, deployed.returnValues.newContract);

    if (verify === "true") {
      console.log("Waiting half a minute to start verification");
      await sleep(30000);
      await hre.run("verify:verify", {
        address: deployed.returnValues.newContract,
        constructorArguments: constructorArgs,
      });
    }
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
