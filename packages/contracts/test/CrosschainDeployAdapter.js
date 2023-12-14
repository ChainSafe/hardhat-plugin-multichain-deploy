const { loadFixture, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const chai = require("chai");
const { expect } = chai;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const REQUEST_GAS_LIMIT = 1000000;
const DOMAIN_ID = 10;
const RESOURCE_ID = "0x000000000000000000000000000000000000000000000000000000000000cafe";
const SALT = "0xcafe00000000000000000000000000000000000000000000000000000000cafe";
const UNIQUE = true;
const NON_UNIQUE = false;

describe("CrosschainDeployAdapter", function () {
  const deploy = async (contractName, signer, ...params) => {
    const factory = await ethers.getContractFactory(contractName);
    const instance = await factory.connect(signer).deploy(...params);
    await instance.waitForDeployment();
    return instance;
  };

  const getDeployBytecode = async (contractName, ...params) => {
    const tx = await getBytecodeAndConstructorArgs(contractName, ...params);
    return tx.data;
  };

  const getBytecodeAndConstructorArgs = async (contractName, ...params) => {
    const factory = await ethers.getContractFactory(contractName);
    const tx = await factory.getDeployTransaction(...params);
    return {
      bytecode: factory.bytecode,
      args: ethers.dataSlice(tx.data, ethers.dataLength(factory.bytecode)),
      data: tx.data,
    };
  };

  const getPureBytecode = async (contractName) => {
    const factory = await ethers.getContractFactory(contractName);
    return factory.bytecode;
  };

  const deployAdapter = async () => {
    const [deployer, user, handler] = await ethers.getSigners();
    const feeHandler = await deploy("MockFeeHandler", deployer);
    const bridge = await deploy(
      "MockBridge", deployer, handler.address, feeHandler.target, DOMAIN_ID);
    const createX = await deploy("CreateX", deployer);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      createX.target,
      bridge.target,
      RESOURCE_ID,
    );
    const salt = `${deployer.address}000000000000000000000000`;
    const receipt = await (await createX["deployCreate3(bytes32,bytes)"](salt, adapterBytecode)).wait();
    const adapter = await ethers.getContractAt("CrosschainDeployAdapter", receipt.logs[1].args[0]);

    return { createX, adapter, bridge, feeHandler };
  };

  const expectEvents = async (tx, expectedCount) => {
    const receipt = await (await tx).wait();
    expect(receipt.events.length).to.equal(expectedCount);
    return expect(tx);
  };

  const bigintToNumber = (list) => {
    return list.map(el => {
      if (Array.isArray(el)) {
        return bigintToNumber(el);
      }
      return (typeof el == "bigint" && el <= Number.MAX_SAFE_INTEGER) ? parseInt(el) : el;
    });
  };

  const expectContractEvents = async (tx, contract, expectedEvents) => {
    const receipt = await (await tx).wait();
    const events = receipt.logs.filter(event => event.address == contract.target)
      .map(event => contract.interface.parseLog(event));
    expect(events.length).to.equal(expectedEvents.length);
    events.forEach((event, index) => {
      expect(event.name).to.equal(expectedEvents[index][0]);
      expect(bigintToNumber(event.args)).to.eql(expectedEvents[index].slice(1));
    });
  };

  const toBytesHex = (num, lenBytes) => {
    const hex = num.toString(16);
    return ethers.zeroPadValue(`0x${hex.length % 2 == 0 ? "" : "0"}${hex}`, lenBytes).slice(2);
  };

  it.only("should deploy adapter and have valid defaults", async function () {
    const { adapter, createX, bridge } = await loadFixture(deployAdapter);
    expect(await adapter.FACTORY()).to.equal(createX.target);
    expect(await adapter.BRIDGE()).to.equal(bridge.target);
    expect(await adapter.RESOURCE_ID()).to.equal(RESOURCE_ID);
    expect(await adapter.DOMAIN_ID()).to.equal(DOMAIN_ID);
  });

  it("should fail to deploy on invalid input lengths", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20;
    const newBridge = await deploy("MockBridge", deployer, handler.address, feeHandler.target, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      newBridge.target,
      resourceId,
    );
    const gasLimit = 2000000;
    await expect(adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [DOMAIN_ID], [0, 0]
    )).to.be.revertedWithCustomError(adapter, "InvalidLength");
    await expect(adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [DOMAIN_ID, domainId], [0]
    )).to.be.revertedWithCustomError(adapter, "InvalidLength");
    await expect(adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x", "0x"], [DOMAIN_ID], [0]
    )).to.be.revertedWithCustomError(adapter, "InvalidLength");
    await expect(adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x", "0x"], ["0x"], [DOMAIN_ID], [0]
    )).to.be.revertedWithCustomError(adapter, "InvalidLength");
  });

  it("should fail to deploy with insufficient fee", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20;
    const newBridge = await deploy("MockBridge", deployer, handler.address, feeHandler.target, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      newBridge.target,
      resourceId,
    );
    const gasLimit = 2000000;
    await expect(adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [10], {value: 9}
    )).to.be.revertedWithCustomError(adapter, "InsufficientFee");
  });

  it("should fail to deploy with excess fee", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20;
    const newBridge = await deploy("MockBridge", deployer, handler.address, feeHandler.target, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      newBridge.target,
      resourceId,
    );
    const gasLimit = 2000000;
    await expect(adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [10], {value: 11}
    )).to.be.revertedWithCustomError(adapter, "ExcessFee");
  });

  it("should allow to deploy non-unique to the current chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20;
    const newBridge = await deploy("MockBridge", deployer, handler.address, feeHandler.target, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      newBridge.target,
      resourceId,
    );
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [DOMAIN_ID], [0]);
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, NON_UNIQUE);
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, NON_UNIQUE);
    await expectContractEvents(tx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    await expectContractEvents(tx, bridge, []);
    const newAdapter = await ethers.getContractAt("CrosschainDeployAdapter", expectedAddress);
    expect(await newAdapter.FACTORY()).to.equal(user.address);
    expect(await newAdapter.BRIDGE()).to.equal(newBridge.target);
    expect(await newAdapter.RESOURCE_ID()).to.equal(resourceId);
    expect(await newAdapter.DOMAIN_ID()).to.equal(domainId);
  });

  it("should allow to deploy unique to the current chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const resourceId = "0x000000000000000000000000000000000000000000000000000000000000caf1";
    const domainId = 20;
    const newBridge = await deploy("MockBridge", deployer, handler.address, feeHandler.target, 20);
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      newBridge.target,
      resourceId,
    );
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x"], ["0x"], [DOMAIN_ID], [0]);
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    await expectContractEvents(tx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    await expectContractEvents(tx, bridge, []);
    const newAdapter = await ethers.getContractAt("CrosschainDeployAdapter", expectedAddress);
    expect(await newAdapter.FACTORY()).to.equal(user.address);
    expect(await newAdapter.BRIDGE()).to.equal(newBridge.target);
    expect(await newAdapter.RESOURCE_ID()).to.equal(resourceId);
    expect(await newAdapter.DOMAIN_ID()).to.equal(domainId);
  });

  it("should have different unique vs non-unique deployed addresses", async function () {
    const { adapter, createX } = await loadFixture(deployAdapter);
    const [deployer] = await ethers.getSigners();
    const unique = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const nonUnique = await adapter.computeContractAddress(deployer.address, SALT, NON_UNIQUE);
    expect(unique).to.not.equal(nonUnique);
  });

  it("should have different deployed addresses for different deployers", async function () {
    const { adapter, createX } = await loadFixture(deployAdapter);
    const [deployer, user] = await ethers.getSigners();
    const unique1 = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const unique2 = await adapter.computeContractAddress(user.address, SALT, UNIQUE);
    const nonUnique1 = await adapter.computeContractAddress(deployer.address, SALT, NON_UNIQUE);
    const nonUnique2 = await adapter.computeContractAddress(user.address, SALT, NON_UNIQUE);
    expect(unique1).to.not.equal(unique2);
    expect(nonUnique1).to.not.equal(nonUnique2);
  });

  it("should have different deployed addresses for different salts", async function () {
    const { adapter, createX } = await loadFixture(deployAdapter);
    const [deployer] = await ethers.getSigners();
    const salt2 = "0x1afe00000000000000000000000000000000000000000000000000000000cafe";
    const unique1 = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const unique2 = await adapter.computeContractAddress(deployer.address, salt2, UNIQUE);
    const nonUnique1 = await adapter.computeContractAddress(deployer.address, SALT, NON_UNIQUE);
    const nonUnique2 = await adapter.computeContractAddress(deployer.address, salt2, NON_UNIQUE);
    expect(unique1).to.not.equal(unique2);
    expect(nonUnique1).to.not.equal(nonUnique2);
  });

  it("should fail to deploy to another chain if called not by handler", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId = 20;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [fee], {value: fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, NON_UNIQUE);
    const executeData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData;
    const handlerExecuteData =
      "0x" +
      adapter.execute.fragment.selector.slice(2) +
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [adapter.target]).slice(2) +
      executeData;
    await expect(user.sendTransaction(
      {to: adapter.target, data: handlerExecuteData}
    )).to.be.revertedWithCustomError(adapter, "InvalidHandler");
  });

  it("should fail to deploy to another chain if requested not by adapter", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId = 20;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [fee], {value: fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, NON_UNIQUE);
    const executeData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData;
    const handlerExecuteData =
      "0x" +
      adapter.execute.fragment.selector.slice(2) +
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [bridge.target]).slice(2) +
      executeData;
    await expect(handler.sendTransaction(
      {to: adapter.target, data: handlerExecuteData}
    )).to.be.revertedWithCustomError(adapter, "InvalidOrigin");
  });

  it("should allow to deploy non-unique to another chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId = 20;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, NON_UNIQUE, ["0x"], ["0x"], [domainId], [fee], {value: fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, NON_UNIQUE);
    const executeData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer.address, fortifiedSalt, domainId],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const handlerExecuteData =
      "0x" +
      adapter.execute.fragment.selector.slice(2) +
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [adapter.target]).slice(2) +
      executeData;
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, NON_UNIQUE);
    const execTx = await handler.sendTransaction({to: adapter.target, data: handlerExecuteData});
    await expectContractEvents(execTx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    const newAdapter = await ethers.getContractAt("CrosschainDeployAdapter", expectedAddress);
    expect(await newAdapter.FACTORY()).to.equal(user.address);
    expect(await newAdapter.BRIDGE()).to.equal(bridge.target);
    expect(await newAdapter.RESOURCE_ID()).to.equal(RESOURCE_ID);
    expect(await newAdapter.DOMAIN_ID()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy unique to another chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId = 20;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x"], ["0x"], [domainId], [fee], {value: fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const executeData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer.address, fortifiedSalt, domainId],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const handlerExecuteData =
      "0x" +
      adapter.execute.fragment.selector.slice(2) +
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [adapter.target]).slice(2) +
      executeData;
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const execTx = await handler.sendTransaction({to: adapter.target, data: handlerExecuteData});
    await expectContractEvents(execTx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    const newAdapter = await ethers.getContractAt("CrosschainDeployAdapter", expectedAddress);
    expect(await newAdapter.FACTORY()).to.equal(user.address);
    expect(await newAdapter.BRIDGE()).to.equal(bridge.target);
    expect(await newAdapter.RESOURCE_ID()).to.equal(RESOURCE_ID);
    expect(await newAdapter.DOMAIN_ID()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy and initialize to another chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId = 20;
    const init = 5;
    const mockBridgeBytecode = await getDeployBytecode(
      "MockBridge",
      handler.address,
      feeHandler.target,
      DOMAIN_ID,
    );
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const initialize = (await bridge.initialize.populateTransaction(init)).data;
    const tx = await adapter.deploy(
      mockBridgeBytecode, gasLimit, SALT, UNIQUE, ["0x"], [initialize], [domainId], [fee], {value: fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const executeData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, mockBridgeBytecode, initialize, fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer.address, fortifiedSalt, domainId],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const handlerExecuteData =
      "0x" +
      adapter.execute.fragment.selector.slice(2) +
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [adapter.target]).slice(2) +
      executeData;
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const execTx = await handler.sendTransaction({to: adapter.target, data: handlerExecuteData});
    await expectContractEvents(execTx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    const newBridge = await ethers.getContractAt("MockBridge", expectedAddress);
    expect(await newBridge._resourceIDToHandlerAddress(RESOURCE_ID)).to.equal(handler.address);
    expect(await newBridge._feeHandler()).to.equal(feeHandler.target);
    expect(await newBridge._domainID()).to.equal(DOMAIN_ID);
    expect(await newBridge.initialized()).to.equal(init);
  });

  it("should allow to deploy multiple to another chain", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId1 = 20;
    const domainId2 = 30;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x"], ["0x", "0x"], [domainId1, domainId2], [fee, fee * 2n], {value: fee * 3n});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const executeData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer.address, fortifiedSalt, domainId1],
      ["DeployRequested", deployer.address, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee * 2n],
    ]);
  });

  it("should allow to deploy multiple to another chain and current chain first", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId1 = 20;
    const domainId2 = 30;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [DOMAIN_ID, domainId1, domainId2], [0, fee, fee], {value: fee + fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const executeData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
      ["DeployRequested", deployer.address, fortifiedSalt, domainId1],
      ["DeployRequested", deployer.address, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const newAdapter = await ethers.getContractAt("CrosschainDeployAdapter", expectedAddress);
    expect(await newAdapter.FACTORY()).to.equal(user.address);
    expect(await newAdapter.BRIDGE()).to.equal(bridge.target);
    expect(await newAdapter.RESOURCE_ID()).to.equal(RESOURCE_ID);
    expect(await newAdapter.DOMAIN_ID()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy multiple to another chain and current chain in the middle", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId1 = 20;
    const domainId2 = 30;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [domainId1, DOMAIN_ID, domainId2], [fee, 0, fee], {value: fee + fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const executeData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer.address, fortifiedSalt, domainId1],
      ["Deployed", fortifiedSalt, expectedAddress],
      ["DeployRequested", deployer.address, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const newAdapter = await ethers.getContractAt("CrosschainDeployAdapter", expectedAddress);
    expect(await newAdapter.FACTORY()).to.equal(user.address);
    expect(await newAdapter.BRIDGE()).to.equal(bridge.target);
    expect(await newAdapter.RESOURCE_ID()).to.equal(RESOURCE_ID);
    expect(await newAdapter.DOMAIN_ID()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy multiple to another chain and current chain in the end", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId1 = 20;
    const domainId2 = 30;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const tx = await adapter.deploy(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [domainId1, domainId2, DOMAIN_ID], [fee, fee, 0], {value: fee + fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const executeData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, adapterBytecode, "0x", fortifiedSalt]
    ).slice(66);
    const expectedDepositData =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer.address, fortifiedSalt, domainId1],
      ["DeployRequested", deployer.address, fortifiedSalt, domainId2],
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData.toLowerCase(), "0x", fee],
    ]);
    const newAdapter = await ethers.getContractAt("CrosschainDeployAdapter", expectedAddress);
    expect(await newAdapter.FACTORY()).to.equal(user.address);
    expect(await newAdapter.BRIDGE()).to.equal(bridge.target);
    expect(await newAdapter.RESOURCE_ID()).to.equal(RESOURCE_ID);
    expect(await newAdapter.DOMAIN_ID()).to.equal(DOMAIN_ID);
  });

  it("should allow to deploy and initialize multiple to another chain and current chain first", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId1 = 20;
    const domainId2 = 30;
    const init1 = 5;
    const init2 = 8;
    const init3 = 13;
    const mockBridgeBytecode = await getPureBytecode("MockBridge");
    const constructorArgs1 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler.address,
      feeHandler.target,
      DOMAIN_ID,
    )).args;
    const constructorArgs2 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler.address,
      feeHandler.target,
      domainId1,
    )).args;
    const constructorArgs3 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler.address,
      feeHandler.target,
      domainId2,
    )).args;
    const constr = [
      constructorArgs1,
      constructorArgs2,
      constructorArgs3,
    ];
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const initialize = [
      (await bridge.initialize.populateTransaction(init1)).data,
      (await bridge.initialize.populateTransaction(init2)).data,
      (await bridge.initialize.populateTransaction(init3)).data,
    ];
    const tx = await adapter.deploy(
      mockBridgeBytecode, gasLimit, SALT, UNIQUE, constr, initialize, [DOMAIN_ID, domainId1, domainId2], [0, fee, fee], {value: fee + fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const executeData1 = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, ethers.concat([mockBridgeBytecode, constr[1]]), initialize[1], fortifiedSalt]
    ).slice(66);
    const executeData2 = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, ethers.concat([mockBridgeBytecode, constr[2]]), initialize[2], fortifiedSalt]
    ).slice(66);
    const expectedDepositData1 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData1;
    const expectedDepositData2 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData2;
    await expectContractEvents(tx, adapter, [
      ["Deployed", fortifiedSalt, expectedAddress],
      ["DeployRequested", deployer.address, fortifiedSalt, domainId1],
      ["DeployRequested", deployer.address, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData1.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData2.toLowerCase(), "0x", fee],
    ]);
    const newBridge = await ethers.getContractAt("MockBridge", expectedAddress);
    expect(await newBridge._resourceIDToHandlerAddress(RESOURCE_ID)).to.equal(handler.address);
    expect(await newBridge._feeHandler()).to.equal(feeHandler.target);
    expect(await newBridge._domainID()).to.equal(DOMAIN_ID);
    expect(await newBridge.initialized()).to.equal(init1);
  });

  it("should allow to deploy and initialize multiple to another chain and current chain in the middle", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId1 = 20;
    const domainId2 = 30;
    const init1 = 5;
    const init2 = 8;
    const init3 = 13;
    const mockBridgeBytecode = await getPureBytecode("MockBridge");
    const constructorArgs1 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler.address,
      feeHandler.target,
      DOMAIN_ID,
    )).args;
    const constructorArgs2 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler.address,
      feeHandler.target,
      domainId1,
    )).args;
    const constructorArgs3 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler.address,
      feeHandler.target,
      domainId2,
    )).args;
    const constr = [
      constructorArgs1,
      constructorArgs2,
      constructorArgs3,
    ];
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const initialize = [
      (await bridge.initialize.populateTransaction(init1)).data,
      (await bridge.initialize.populateTransaction(init2)).data,
      (await bridge.initialize.populateTransaction(init3)).data,
    ];
    const tx = await adapter.deploy(
      mockBridgeBytecode, gasLimit, SALT, UNIQUE, constr, initialize, [domainId1, DOMAIN_ID, domainId2], [fee, 0, fee], {value: fee + fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const executeData1 = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, ethers.concat([mockBridgeBytecode, constr[0]]), initialize[0], fortifiedSalt]
    ).slice(66);
    const executeData2 = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, ethers.concat([mockBridgeBytecode, constr[2]]), initialize[2], fortifiedSalt]
    ).slice(66);
    const expectedDepositData1 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData1;
    const expectedDepositData2 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData2;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer.address, fortifiedSalt, domainId1],
      ["Deployed", fortifiedSalt, expectedAddress],
      ["DeployRequested", deployer.address, fortifiedSalt, domainId2],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData1.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData2.toLowerCase(), "0x", fee],
    ]);
    const newBridge = await ethers.getContractAt("MockBridge", expectedAddress);
    expect(await newBridge._resourceIDToHandlerAddress(RESOURCE_ID)).to.equal(handler.address);
    expect(await newBridge._feeHandler()).to.equal(feeHandler.target);
    expect(await newBridge._domainID()).to.equal(domainId1);
    expect(await newBridge.initialized()).to.equal(init2);
  });

  it("should allow to deploy and initialize multiple to another chain and current chain in the end", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId1 = 20;
    const domainId2 = 30;
    const init1 = 5;
    const init2 = 8;
    const init3 = 13;
    const mockBridgeBytecode = await getPureBytecode("MockBridge");
    const constructorArgs1 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler.address,
      feeHandler.target,
      DOMAIN_ID,
    )).args;
    const constructorArgs2 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler.address,
      feeHandler.target,
      domainId1,
    )).args;
    const constructorArgs3 = (await getBytecodeAndConstructorArgs(
      "MockBridge",
      handler.address,
      feeHandler.target,
      domainId2,
    )).args;
    const constr = [
      constructorArgs1,
      constructorArgs2,
      constructorArgs3,
    ];
    const fee = ethers.parseUnits("0.01");
    const gasLimit = 2000000;
    const initialize = [
      (await bridge.initialize.populateTransaction(init1)).data,
      (await bridge.initialize.populateTransaction(init2)).data,
      (await bridge.initialize.populateTransaction(init3)).data,
    ];
    const tx = await adapter.deploy(
      mockBridgeBytecode, gasLimit, SALT, UNIQUE, constr, initialize, [domainId1, domainId2, DOMAIN_ID], [fee, fee, 0], {value: fee + fee});
    const fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    const expectedAddress = await adapter.computeContractAddress(deployer.address, SALT, UNIQUE);
    const executeData1 = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, ethers.concat([mockBridgeBytecode, constr[0]]), initialize[0], fortifiedSalt]
    ).slice(66);
    const executeData2 = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes", "bytes", "bytes32"],
      [ZERO_ADDRESS, ethers.concat([mockBridgeBytecode, constr[1]]), initialize[1], fortifiedSalt]
    ).slice(66);
    const expectedDepositData1 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData1;
    const expectedDepositData2 =
      "0x" +
      toBytesHex(gasLimit, 32) +
      toBytesHex(4, 2) +
      adapter.execute.fragment.selector.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      toBytesHex(20, 1) +
      adapter.target.slice(2) +
      executeData2;
    await expectContractEvents(tx, adapter, [
      ["DeployRequested", deployer.address, fortifiedSalt, domainId1],
      ["DeployRequested", deployer.address, fortifiedSalt, domainId2],
      ["Deployed", fortifiedSalt, expectedAddress],
    ]);
    await expectContractEvents(tx, bridge, [
      ["Deposit", domainId1, RESOURCE_ID, expectedDepositData1.toLowerCase(), "0x", fee],
      ["Deposit", domainId2, RESOURCE_ID, expectedDepositData2.toLowerCase(), "0x", fee],
    ]);
    const newBridge = await ethers.getContractAt("MockBridge", expectedAddress);
    expect(await newBridge._resourceIDToHandlerAddress(RESOURCE_ID)).to.equal(handler.address);
    expect(await newBridge._feeHandler()).to.equal(feeHandler.target);
    expect(await newBridge._domainID()).to.equal(domainId2);
    expect(await newBridge.initialized()).to.equal(init3);
  });

  it("should fail to calculate deploy fee with invalid lengths", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId1 = 20;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const gasLimit = 2000000;
    await expect(adapter.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x"], ["0x", "0x"], [DOMAIN_ID]
    )).to.be.revertedWithCustomError(adapter, "InvalidLength");
    await expect(adapter.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x"], ["0x"], [DOMAIN_ID, domainId1]
    )).to.be.revertedWithCustomError(adapter, "InvalidLength");
    await expect(adapter.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x"], ["0x"], [DOMAIN_ID]
    )).to.be.revertedWithCustomError(adapter, "InvalidLength");
  });

  it("should calculate deploy fee", async function () {
    const { adapter, createX, bridge, feeHandler } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    const domainId1 = 20;
    const domainId2 = 30;
    const adapterBytecode = await getDeployBytecode(
      "CrosschainDeployAdapter",
      user.address,
      bridge.target,
      RESOURCE_ID,
    );
    const gasLimit = 2000000;
    let fees = await adapter.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [DOMAIN_ID, domainId1, domainId2]);
    expect(fees).to.eql([0n, ethers.parseUnits("0.01") / 20n, ethers.parseUnits("0.01") / 30n]);
    fees = await adapter.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [domainId1, DOMAIN_ID, domainId2]);
    expect(fees).to.eql([ethers.parseUnits("0.01") / 20n, 0n, ethers.parseUnits("0.01") / 30n]);
    fees = await adapter.calculateDeployFee(
      adapterBytecode, gasLimit, SALT, UNIQUE, ["0x", "0x", "0x"], ["0x", "0x", "0x"], [domainId1, domainId2, DOMAIN_ID]);
    expect(fees).to.eql([ethers.parseUnits("0.01") / 20n, ethers.parseUnits("0.01") / 30n, 0n]);
  });

  it("should fortify salt", async function () {
    const { adapter } = await loadFixture(deployAdapter);
    const [deployer, user, handler] = await ethers.getSigners();
    let fortifiedSalt = await adapter.fortify(deployer.address, SALT, UNIQUE);
    let expectedSalt =
      "0x" +
      adapter.target.slice(2) +
      toBytesHex(1, 1) +
      ethers.solidityPackedKeccak256(["address", "bytes32"], [deployer.address, SALT]).substr(2, 22);
    expect(fortifiedSalt).to.equal(expectedSalt.toLowerCase());
    fortifiedSalt = await adapter.fortify(deployer.address, SALT, NON_UNIQUE);
    expectedSalt =
      "0x" +
      adapter.target.slice(2) +
      toBytesHex(0, 1) +
      ethers.solidityPackedKeccak256(["address", "bytes32"], [deployer.address, SALT]).substr(2, 22);
    expect(fortifiedSalt).to.equal(expectedSalt.toLowerCase());
    fortifiedSalt = await adapter.fortify(user.address, SALT, NON_UNIQUE);
    expectedSalt =
      "0x" +
      adapter.target.slice(2) +
      toBytesHex(0, 1) +
      ethers.solidityPackedKeccak256(["address", "bytes32"], [user.address, SALT]).substr(2, 22);
    expect(fortifiedSalt).to.equal(expectedSalt.toLowerCase());
  });
});
