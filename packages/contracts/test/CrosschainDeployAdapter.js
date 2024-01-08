const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const chai = require("chai");
const { expect } = chai;
const { hexToBytes, bytesToHex, padLeft, sha3 } = web3.utils;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const REQUEST_GAS_LIMIT = 1000000;
const DOMAIN_ID = 10n;
const RESOURCE_ID = "0x000000000000000000000000000000000000000000000000000000000000cafe";
const SALT = "0xcafe00000000000000000000000000000000000000000000000000000000cafe";
const UNIQUE = true;
const NON_UNIQUE = false;

describe("CrosschainDeployAdapter", function () {
  const getContractAt = (contractName, address, from) => {
    const artifact = artifacts.readArtifactSync(contractName);
    const contract = new web3.eth.Contract(artifact.abi, address, { from });
    return contract;
  };

  const deploy = async (contractName, signer, ...params) => {
    const artifact = artifacts.readArtifactSync(contractName);
    const contract = new web3.eth.Contract(artifact.abi);
    const response = await contract.deploy({
      data: artifact.bytecode,
      arguments: params,
    }).send({ from: signer });
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

  const deployAdapter = async () => {
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const feeHandler = await deploy("MockFeeHandler", deployer);
    const bridge = await deploy(
      "MockBridge", deployer, handler, feeHandler.options.address, DOMAIN_ID);
    const createX = await deploy("CreateX", deployer);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      createX.options.address,
      bridge.options.address,
      RESOURCE_ID,
    );
    const salt = `${deployer}000000000000000000000000`;
    const receipt = await createX.methods["deployCreate3(bytes32,bytes)"](salt, adapterBytecode).send();
    const adapter = getContractAt("CrosschainDeployAdapter", receipt.events.ContractCreation.returnValues.newContract, deployer);

    return { createX, adapter, bridge, feeHandler };
  };

  const stringToNumber = (value) => {
    if (value && value.toString().startsWith("0x")) {
      return value;
    }
    let converted;
    try {
      converted = BigInt(value);
    } catch(err) {
      return value;
    }
    return converted <= BigInt(Number.MAX_SAFE_INTEGER) ? parseInt(converted) : converted;
  };

  const mixToArray = (mix) => {
    if (Array.isArray(mix)) {
      return mix;
    }
    const result = [];
    for (let i = 0;; i++) {
      const el = mix[i];
      if (el === undefined) {
        return result;
      }
      result.push(stringToNumber(el));
    }
  };

  // This is needed to access events from contracts touched by transaction.
  const expectContractEvents = async (tx, contract, expectedEvents) => {
    const receipt = await tx;
    const txEvents = await contract.getPastEvents('allEvents', {
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    const events = txEvents.filter(event => event.transactionHash == tx.transactionHash);
    expect(events.length).to.equal(expectedEvents.length);
    events.forEach((event, index) => {
      expect(event.event).to.equal(expectedEvents[index][0]);
      const convertedEvents = expectedEvents[index].slice(1).map(stringToNumber);
      expect(mixToArray(event.returnValues)).to.eql(convertedEvents);
    });
  };

  const toBytesHex = (num, lenBytes) => {
    const hex = num.toString(16);
    return padLeft(`0x${hex}`, lenBytes * 2).slice(2);
  };

  const expectRevert = async (tx, expectedErrorName, ...params) => {
    try {
      await tx;
    } catch (err) {
      if (!err.innerError) {
        expect(err.reason).to.include(expectedErrorName);
        expect(params.length).to.equal(0, "Cannot assert params");
        return;
      }
      expect(err.innerError.errorName).to.equal(expectedErrorName);
      expect(mixToArray(err.innerError.errorArgs)).to.eql(params);
      return;
    }
    throw new Error("Transaction did not revert");
  };

  const getFunctionSignature = (contract, functionName) => {
    return Object.entries(contract._functions)
      .filter(el => el[0].includes(functionName))[0][1].signature;
  };

  const toWei = (value, units = "ether") => {
    return BigInt(web3.utils.toWei(value, units));
  };

  const encodePacked = (types, values) => {
    const input = types.map((el, index) => ({type: el, value: values[index]}));
    return web3.utils.encodePacked(...input);
  };

  const soliditySha3 = (types, values) => {
    return sha3(encodePacked(types, values));
  };

  it("should deploy adapter and have valid defaults", async function () {
    const { adapter, createX, bridge } = await loadFixture(deployAdapter);
    expect(await adapter.methods.FACTORY().call()).to.equal(createX.options.address);
    expect(await adapter.methods.BRIDGE().call()).to.equal(bridge.options.address);
    expect(await adapter.methods.RESOURCE_ID().call()).to.equal(RESOURCE_ID);
    expect(await adapter.methods.DOMAIN_ID().call()).to.equal(DOMAIN_ID);
  });

  it("should fail to deploy on invalid input lengths", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20n;
    const newBridge = await deploy("MockBridge", deployer, handler, feeHandler.options.address, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      newBridge.options.address,
      resourceId,
    );
    const gasLimit = 2000000;
    await expectRevert(adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [DOMAIN_ID], [0, 0]
    ).send(), "InvalidLength");
    await expectRevert(adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [DOMAIN_ID, domainId], [0]
    ).send(), "InvalidLength");
    await expectRevert(adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x", "0x"], [DOMAIN_ID], [0]
    ).send(), "InvalidLength");
    await expectRevert(adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x", "0x"], ["0x"], [DOMAIN_ID], [0]
    ).send(), "InvalidLength");
  });

  it("should fail to deploy with insufficient fee", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20n;
    const newBridge = await deploy("MockBridge", deployer, handler, feeHandler.options.address, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      newBridge.options.address,
      resourceId,
    );
    const gasLimit = 2000000;
    await expectRevert(adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [10]
    ).send({value: 9}), "InsufficientFee");
  });

  it("should fail to deploy with excess fee", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20n;
    const newBridge = await deploy("MockBridge", deployer, handler, feeHandler.options.address, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      newBridge.options.address,
      resourceId,
    );
    const gasLimit = 2000000;
    await expectRevert(adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [10]
    ).send({value: 11}), "ExcessFee");
  });

  it("should allow to deploy non-unique to the current chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20n;
    const newBridge = await deploy("MockBridge", deployer, handler, feeHandler.options.address, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      newBridge.options.address,
      resourceId,
    );
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [DOMAIN_ID], [0]).send();
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, NON_UNIQUE).call();
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, NON_UNIQUE).call();
    await expectContractEvents(tx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    await expectContractEvents(tx, bridge, []);
    const newAdapter = getContractAt("CrosschainDeployAdapter", expectedAddress, deployer);
    expect(await newAdapter.methods.FACTORY().call()).to.equal(user);
    expect(await newAdapter.methods.BRIDGE().call()).to.equal(newBridge.options.address);
    expect(await newAdapter.methods.RESOURCE_ID().call()).to.equal(resourceId);
    expect(await newAdapter.methods.DOMAIN_ID().call()).to.equal(domainId);
  });

  it("should allow to deploy unique to the current chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20n;
    const newBridge = await deploy("MockBridge", deployer, handler, feeHandler.options.address, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      newBridge.options.address,
      resourceId,
    );
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x"], ["0x"], [DOMAIN_ID], [0]).send();
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    await expectContractEvents(tx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    await expectContractEvents(tx, bridge, []);
    const newAdapter = getContractAt("CrosschainDeployAdapter", expectedAddress, deployer);
    expect(await newAdapter.methods.FACTORY().call()).to.equal(user);
    expect(await newAdapter.methods.BRIDGE().call()).to.equal(newBridge.options.address);
    expect(await newAdapter.methods.RESOURCE_ID().call()).to.equal(resourceId);
    expect(await newAdapter.methods.DOMAIN_ID().call()).to.equal(domainId);
  });

  it("should have different unique vs non-unique deployed addresses", async function () {
    const { adapter, createX } = await loadFixture(deployAdapter);
    const [deployer] = await web3.eth.getAccounts();
    const unique = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const nonUnique = await adapter.methods.computeContractAddress(deployer, SALT, NON_UNIQUE).call();
    expect(unique).to.not.equal(nonUnique);
  });

  it("should have different deployed addresses for different deployers", async function () {
    const { adapter, createX } = await loadFixture(deployAdapter);
    const [deployer, user] = await web3.eth.getAccounts();
    const unique1 = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const unique2 = await adapter.methods.computeContractAddress(user, SALT, UNIQUE).call();
    const nonUnique1 = await adapter.methods.computeContractAddress(deployer, SALT, NON_UNIQUE).call();
    const nonUnique2 = await adapter.methods.computeContractAddress(user, SALT, NON_UNIQUE).call();
    expect(unique1).to.not.equal(unique2);
    expect(nonUnique1).to.not.equal(nonUnique2);
  });

  it("should have different deployed addresses for different salts", async function () {
    const { adapter, createX } = await loadFixture(deployAdapter);
    const [deployer] = await web3.eth.getAccounts();
    const salt2 = "0x1afe00000000000000000000000000000000000000000000000000000000cafe";
    const unique1 = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const unique2 = await adapter.methods.computeContractAddress(deployer, salt2, UNIQUE).call();
    const nonUnique1 = await adapter.methods.computeContractAddress(deployer, SALT, NON_UNIQUE).call();
    const nonUnique2 = await adapter.methods.computeContractAddress(deployer, salt2, NON_UNIQUE).call();
    expect(unique1).to.not.equal(unique2);
    expect(nonUnique1).to.not.equal(nonUnique2);
  });

  it("should fail to deploy to another chain if called not by handler", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId = 20n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [fee]).send({value: fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, NON_UNIQUE).call();
    const executeData = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData;
    const handlerExecuteData =
      "0x" +
      getFunctionSignature(adapter, "execute").slice(2) +
      web3.eth.abi.encodeParameters(["address"], [adapter.options.address]).slice(2) +
      executeData;
    await expectRevert(web3.eth.sendTransaction(
      {from: user, to: adapter.options.address, data: handlerExecuteData}
    ), "InvalidHandler");
  });

  it("should fail to deploy to another chain if requested not by adapter", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId = 20n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [fee]).send({value: fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, NON_UNIQUE).call();
    const executeData = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData;
    const handlerExecuteData =
      "0x" +
      getFunctionSignature(adapter, "execute").slice(2) +
      web3.eth.abi.encodeParameters(["address"], [bridge.options.address]).slice(2) +
      executeData;
    await expectRevert(web3.eth.sendTransaction(
      {from: handler, to: adapter.options.address, data: handlerExecuteData}
    ), "InvalidOrigin");
  });

  it("should allow to deploy non-unique to another chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId = 20n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [fee]).send({value: fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, NON_UNIQUE).call();
    const executeData = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer, fortifiedSalt, domainId],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const handlerExecuteData =
      "0x" +
      getFunctionSignature(adapter, "execute").slice(2) +
      web3.eth.abi.encodeParameters(["address"], [adapter.options.address]).slice(2) +
      executeData;
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, NON_UNIQUE).call();
    const execTx = await web3.eth.sendTransaction({from: handler, to: adapter.options.address, data: handlerExecuteData});
    await expectContractEvents(execTx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    const newAdapter = getContractAt("CrosschainDeployAdapter", expectedAddress, deployer);
    expect(await newAdapter.methods.FACTORY().call()).to.equal(user);
    expect(await newAdapter.methods.BRIDGE().call()).to.equal(bridge.options.address);
    expect(await newAdapter.methods.RESOURCE_ID().call()).to.equal(RESOURCE_ID);
    expect(await newAdapter.methods.DOMAIN_ID().call()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy unique to another chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId = 20n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x"], ["0x"], [domainId], [fee]).send({value: fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const executeData = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer, fortifiedSalt, domainId],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const handlerExecuteData =
      "0x" +
      getFunctionSignature(adapter, "execute").slice(2) +
      web3.eth.abi.encodeParameters(["address"], [adapter.options.address]).slice(2) +
      executeData;
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const execTx = await web3.eth.sendTransaction({from: handler, to: adapter.options.address, data: handlerExecuteData});
    await expectContractEvents(execTx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    const newAdapter = getContractAt("CrosschainDeployAdapter", expectedAddress, deployer);
    expect(await newAdapter.methods.FACTORY().call()).to.equal(user);
    expect(await newAdapter.methods.BRIDGE().call()).to.equal(bridge.options.address);
    expect(await newAdapter.methods.RESOURCE_ID().call()).to.equal(RESOURCE_ID);
    expect(await newAdapter.methods.DOMAIN_ID().call()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy and initialize to another chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId = 20n;
    const init = 5n;
    const mockBridgeBytecode = await getDeployBytecode(
      "MockBridge",
      handler,
      feeHandler.options.address,
      DOMAIN_ID,
    );
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const initialize = await bridge.methods.initialize(init).encodeABI();
    const tx = await adapter.methods.deploy(
      mockBridgeBytecode, gasLimit, SALT, UNIQUE, ["0x"], [initialize], [domainId], [fee]).send({value: fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const executeData = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, mockBridgeBytecode, initialize, fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer, fortifiedSalt, domainId],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const handlerExecuteData =
      "0x" +
      getFunctionSignature(adapter, "execute").slice(2) +
      web3.eth.abi.encodeParameters(["address"], [adapter.options.address]).slice(2) +
      executeData;
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const execTx = await web3.eth.sendTransaction({from: handler, to: adapter.options.address, data: handlerExecuteData});
    await expectContractEvents(execTx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    const newBridge = getContractAt("MockBridge", expectedAddress, deployer);
    expect(await newBridge.methods._resourceIDToHandlerAddress(RESOURCE_ID).call()).to.equal(handler);
    expect(await newBridge.methods._feeHandler().call()).to.equal(feeHandler.options.address);
    expect(await newBridge.methods._domainID().call()).to.equal(DOMAIN_ID);
    expect(await newBridge.methods.initialized().call()).to.equal(init);
  });

  it("should allow to deploy multiple to another chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId1 = 20n;
    const domainId2 = 30n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x"], ["0x", "0x"], [domainId1, domainId2], [fee, fee * 2n]).send({value: fee * 3n});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const executeData = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer, fortifiedSalt, domainId1],
      ["DeployRequested", deployer, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee * 2n],
    ]);
  });

  it("should allow to deploy multiple to another chain and current chain first", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId1 = 20n;
    const domainId2 = 30n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [DOMAIN_ID, domainId1, domainId2], [0, fee, fee]).send({value: fee + fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const executeData = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
      ["DeployRequested", deployer, fortifiedSalt, domainId1],
      ["DeployRequested", deployer, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const newAdapter = getContractAt("CrosschainDeployAdapter", expectedAddress, deployer);
    expect(await newAdapter.methods.FACTORY().call()).to.equal(user);
    expect(await newAdapter.methods.BRIDGE().call()).to.equal(bridge.options.address);
    expect(await newAdapter.methods.RESOURCE_ID().call()).to.equal(RESOURCE_ID);
    expect(await newAdapter.methods.DOMAIN_ID().call()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy multiple to another chain and current chain in the middle", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId1 = 20n;
    const domainId2 = 30n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [domainId1, DOMAIN_ID, domainId2], [fee, 0, fee]).send({value: fee + fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const executeData = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer, fortifiedSalt, domainId1],
      ["Deployed", fortifiedSalt, expectedAddress],
      ["DeployRequested", deployer, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const newAdapter = getContractAt("CrosschainDeployAdapter", expectedAddress, deployer);
    expect(await newAdapter.methods.FACTORY().call()).to.equal(user);
    expect(await newAdapter.methods.BRIDGE().call()).to.equal(bridge.options.address);
    expect(await newAdapter.methods.RESOURCE_ID().call()).to.equal(RESOURCE_ID);
    expect(await newAdapter.methods.DOMAIN_ID().call()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy multiple to another chain and current chain in the end", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId1 = 20n;
    const domainId2 = 30n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.methods.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [domainId1, domainId2, DOMAIN_ID], [fee, fee, 0]).send({value: fee + fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const executeData = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer, fortifiedSalt, domainId1],
      ["DeployRequested", deployer, fortifiedSalt, domainId2],
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const newAdapter = getContractAt("CrosschainDeployAdapter", expectedAddress, deployer);
    expect(await newAdapter.methods.FACTORY().call()).to.equal(user);
    expect(await newAdapter.methods.BRIDGE().call()).to.equal(bridge.options.address);
    expect(await newAdapter.methods.RESOURCE_ID().call()).to.equal(RESOURCE_ID);
    expect(await newAdapter.methods.DOMAIN_ID().call()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy and initialize multiple to another chain and current chain first", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId1 = 20n;
    const domainId2 = 30n;
    const init1 = 5n;
    const init2 = 8n;
    const init3 = 13n;
    const mockBridgeBytecode = await getPureBytecode("MockBridge");
    const constructorArgs1 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler,
      feeHandler.options.address,
      DOMAIN_ID,
    )).args;
    const constructorArgs2 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler,
      feeHandler.options.address,
      domainId1,
    )).args;
    const constructorArgs3 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler,
      feeHandler.options.address,
      domainId2,
    )).args;
    const constr = [
      constructorArgs1,
      constructorArgs2,
      constructorArgs3,
    ];
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const initialize = [
      await bridge.methods.initialize(init1).encodeABI(),
      await bridge.methods.initialize(init2).encodeABI(),
      await bridge.methods.initialize(init3).encodeABI(),
    ];
    const tx = await adapter.methods.deploy(
      mockBridgeBytecode, gasLimit, SALT, UNIQUE, constr, initialize, [DOMAIN_ID, domainId1, domainId2], [0, fee, fee]).send({value: fee + fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const executeData1 = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, encodePacked(["bytes", "bytes"], [mockBridgeBytecode, constr[1]]), initialize[1], fortifiedSalt]
    ).slice(66);
    const executeData2 = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, encodePacked(["bytes", "bytes"], [mockBridgeBytecode, constr[2]]), initialize[2], fortifiedSalt]
    ).slice(66);
    const expectedDepositData1 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData1;
    const expectedDepositData2 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData2;
    await expectContractEvents(tx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
      ["DeployRequested", deployer, fortifiedSalt, domainId1],
      ["DeployRequested", deployer, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData1.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData2.toLowerCase(), "0x", fee],
    ]);
    const newBridge = getContractAt("MockBridge", expectedAddress, deployer);
    expect(await newBridge.methods._resourceIDToHandlerAddress(RESOURCE_ID).call()).to.equal(handler);
    expect(await newBridge.methods._feeHandler().call()).to.equal(feeHandler.options.address);
    expect(await newBridge.methods._domainID().call()).to.equal(DOMAIN_ID);
    expect(await newBridge.methods.initialized().call()).to.equal(init1);
  });

  it("should allow to deploy and initialize multiple to another chain and current chain in the middle", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId1 = 20n;
    const domainId2 = 30n;
    const init1 = 5n;
    const init2 = 8n;
    const init3 = 13n;
    const mockBridgeBytecode = await getPureBytecode("MockBridge");
    const constructorArgs1 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler,
      feeHandler.options.address,
      DOMAIN_ID,
    )).args;
    const constructorArgs2 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler,
      feeHandler.options.address,
      domainId1,
    )).args;
    const constructorArgs3 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler,
      feeHandler.options.address,
      domainId2,
    )).args;
    const constr = [
      constructorArgs1,
      constructorArgs2,
      constructorArgs3,
    ];
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const initialize = [
      await bridge.methods.initialize(init1).encodeABI(),
      await bridge.methods.initialize(init2).encodeABI(),
      await bridge.methods.initialize(init3).encodeABI(),
    ];
    const tx = await adapter.methods.deploy(
      mockBridgeBytecode, gasLimit, SALT, UNIQUE, constr, initialize, [domainId1, DOMAIN_ID, domainId2], [fee, 0, fee]).send({value: fee + fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const executeData1 = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, encodePacked(["bytes", "bytes"], [mockBridgeBytecode, constr[0]]), initialize[0], fortifiedSalt]
    ).slice(66);
    const executeData2 = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, encodePacked(["bytes", "bytes"], [mockBridgeBytecode, constr[2]]), initialize[2], fortifiedSalt]
    ).slice(66);
    const expectedDepositData1 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData1;
    const expectedDepositData2 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData2;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer, fortifiedSalt, domainId1],
      ["Deployed", fortifiedSalt, expectedAddress],
      ["DeployRequested", deployer, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData1.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData2.toLowerCase(), "0x", fee],
    ]);
    const newBridge = getContractAt("MockBridge", expectedAddress, deployer);
    expect(await newBridge.methods._resourceIDToHandlerAddress(RESOURCE_ID).call()).to.equal(handler);
    expect(await newBridge.methods._feeHandler().call()).to.equal(feeHandler.options.address);
    expect(await newBridge.methods._domainID().call()).to.equal(domainId1);
    expect(await newBridge.methods.initialized().call()).to.equal(init2);
  });

  it("should allow to deploy and initialize multiple to another chain and current chain in the end", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId1 = 20n;
    const domainId2 = 30n;
    const init1 = 5n;
    const init2 = 8n;
    const init3 = 13n;
    const mockBridgeBytecode = await getPureBytecode("MockBridge");
    const constructorArgs1 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler,
      feeHandler.options.address,
      DOMAIN_ID,
    )).args;
    const constructorArgs2 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler,
      feeHandler.options.address,
      domainId1,
    )).args;
    const constructorArgs3 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler,
      feeHandler.options.address,
      domainId2,
    )).args;
    const constr = [
      constructorArgs1,
      constructorArgs2,
      constructorArgs3,
    ];
    const fee = toWei("0.01");
    const gasLimit = 2000000;
    const initialize = [
      await bridge.methods.initialize(init1).encodeABI(),
      await bridge.methods.initialize(init2).encodeABI(),
      await bridge.methods.initialize(init3).encodeABI(),
    ];
    const tx = await adapter.methods.deploy(
      mockBridgeBytecode, gasLimit, SALT, UNIQUE, constr, initialize, [domainId1, domainId2, DOMAIN_ID], [fee, fee, 0]).send({value: fee + fee});
    const fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    const expectedAddress = await adapter.methods.computeContractAddress(deployer, SALT, UNIQUE).call();
    const executeData1 = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, encodePacked(["bytes", "bytes"], [mockBridgeBytecode, constr[0]]), initialize[0], fortifiedSalt]
    ).slice(66);
    const executeData2 = web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, encodePacked(["bytes", "bytes"], [mockBridgeBytecode, constr[1]]), initialize[1], fortifiedSalt]
    ).slice(66);
    const expectedDepositData1 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData1;
    const expectedDepositData2 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      getFunctionSignature(adapter, "execute").slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      toBytesHex(20, 1) +
      adapter.options.address.slice(2) +
      executeData2;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer, fortifiedSalt, domainId1],
      ["DeployRequested", deployer, fortifiedSalt, domainId2],
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData1.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData2.toLowerCase(), "0x", fee],
    ]);
    const newBridge = getContractAt("MockBridge", expectedAddress, deployer);
    expect(await newBridge.methods._resourceIDToHandlerAddress(RESOURCE_ID).call()).to.equal(handler);
    expect(await newBridge.methods._feeHandler().call()).to.equal(feeHandler.options.address);
    expect(await newBridge.methods._domainID().call()).to.equal(domainId2);
    expect(await newBridge.methods.initialized().call()).to.equal(init3);
  });

  it("should fail to calculate deploy fee with invalid lengths", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId1 = 20n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const gasLimit = 2000000;
    await expectRevert(adapter.methods.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x"], ["0x", "0x"], [DOMAIN_ID]
    ).call(), "InvalidLength");
    await expectRevert(adapter.methods.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x"], ["0x"], [DOMAIN_ID, domainId1]
    ).call(), "InvalidLength");
    await expectRevert(adapter.methods.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x"], ["0x"], [DOMAIN_ID]
    ).call(), "InvalidLength");
  });

  it("should calculate deploy fee", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    const domainId1 = 20n;
    const domainId2 = 30n;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user,
      bridge.options.address,
      RESOURCE_ID,
    );
    const gasLimit = 2000000;
    let fees = await adapter.methods.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [DOMAIN_ID, domainId1, domainId2]).call();
    expect(fees).to.eql([0n, toWei("0.01") / 20n, toWei("0.01") / 30n]);
    fees = await adapter.methods.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [domainId1, DOMAIN_ID, domainId2]).call();
    expect(fees).to.eql([toWei("0.01") / 20n, 0n, toWei("0.01") / 30n]);
    fees = await adapter.methods.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [domainId1, domainId2, DOMAIN_ID]).call();
    expect(fees).to.eql([toWei("0.01") / 20n, toWei("0.01") / 30n, 0n]);
  });

  it("should fortify salt", async function () {
    const { adapter } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await web3.eth.getAccounts();
    let fortifiedSalt = await adapter.methods.fortify(deployer, SALT, UNIQUE).call();
    let expectedSalt =
      "0x" +
      adapter.options.address.slice(2) +
      toBytesHex(1, 1) +
      soliditySha3(["address", "bytes"], [deployer, SALT]).substr(2, 22);
    expect(fortifiedSalt).to.equal(expectedSalt.toLowerCase());
    fortifiedSalt = await adapter.methods.fortify(deployer, SALT, NON_UNIQUE).call();
    expectedSalt =
      "0x" +
      adapter.options.address.slice(2) +
      toBytesHex(0, 1) +
      soliditySha3(["address", "bytes"], [deployer, SALT]).substr(2, 22);
    expect(fortifiedSalt).to.equal(expectedSalt.toLowerCase());
    fortifiedSalt = await adapter.methods.fortify(user, SALT, NON_UNIQUE).call();
    expectedSalt =
      "0x" +
      adapter.options.address.slice(2) +
      toBytesHex(0, 1) +
      soliditySha3(["address", "bytes"], [user, SALT]).substr(2, 22);
    expect(fortifiedSalt).to.equal(expectedSalt.toLowerCase());
  });
});
