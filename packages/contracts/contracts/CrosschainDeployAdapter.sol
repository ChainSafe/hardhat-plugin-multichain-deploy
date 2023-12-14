// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.20;

import "./interfaces/IBridge.sol";
import "./interfaces/ICreateX.sol";

/**
    @title Facilitates deploys of contracts across multiple chains through Sygma.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with the Bridge contract and Permissionless Generic handler.
 */
contract CrosschainDeployAdapter {
    ICreateX public immutable FACTORY;
    IBridge public immutable BRIDGE;
    bytes32 public immutable RESOURCE_ID;
    uint8 public immutable DOMAIN_ID;

    /**
        @notice This event is emitted for each deploy request to other chains.
        @param sender Address that requested deploy.
        @param fortifiedSalt Transformed entropy for contract address generation.
        @param destinationDomainID Target chain Sygma Domain ID.
     */
    event DeployRequested(
        address sender,
        bytes32 fortifiedSalt,
        uint8 destinationDomainID
    );

    /**
        @notice This event is emitted when the new contract is deployed.
        @param fortifiedSalt Transformed entropy for contract address generation.
        @param newContract Address of the deployed contract.
     */
    event Deployed(
        bytes32 fortifiedSalt,
        address newContract
    );

    error InvalidHandler();
    error InvalidLength();
    error InvalidOrigin();
    error InsufficientFee();
    error ExcessFee();

    /**
        @param factory Contract address of previously deployed CreateX.
        @param bridge Contract address of previously deployed Bridge.
        @param resourceID ResourceID in the Bridge used to find address of PremissionlessGenericHandler.
     */
    constructor(ICreateX factory, IBridge bridge, bytes32 resourceID) {
        FACTORY = factory;
        BRIDGE = bridge;
        RESOURCE_ID = resourceID;
        DOMAIN_ID = bridge._domainID();
    }

    modifier onlyHandler() {
        if (msg.sender != BRIDGE._resourceIDToHandlerAddress(RESOURCE_ID)) {
            revert InvalidHandler();
        }
        _;
    }

    /**
        @notice Deposits to the Bridge contract using the PermissionlessGenericHandler,
        @notice to request contract deployments on other chains.
        @param initCode Contract deploy bytecode.
        @param gasLimit Contract deploy and init gas.
        @param salt Entropy for contract address generation.
        @param isUniquePerChain True to have unique addresses on every chain.
        @param constructorArgs Bytes to add to the initCode, or empty, one per chain.
        @param initDatas Bytes to send to the contract after deployment, or empty, one per chain.
        @param destinationDomainIDs Sygma Domain IDs of target chains.
        @param fees Native currency amount to pay for Sygma services, one per chain. Empty for current domain.
     */
    function deploy(
        bytes calldata initCode,
        uint gasLimit,
        bytes32 salt,
        bool isUniquePerChain,
        bytes[] memory constructorArgs,
        bytes[] memory initDatas,
        uint8[] memory destinationDomainIDs,
        uint[] memory fees
    ) external payable {
        uint len = constructorArgs.length;
        if (len != initDatas.length ||
            len != destinationDomainIDs.length ||
            len != fees.length) revert InvalidLength();
        bytes32 fortifiedSalt = fortify(msg.sender, salt, isUniquePerChain);
        for (uint i = 0; i < len; ++i) {
            if (destinationDomainIDs[i] == DOMAIN_ID) {
                deploy(abi.encodePacked(initCode, constructorArgs[i]), initDatas[i], fortifiedSalt);
                continue;
            }
            bytes memory depositData = prepareDepositData(
                gasLimit,
                abi.encodePacked(initCode, constructorArgs[i]),
                initDatas[i],
                fortifiedSalt
            );
            if (fees[i] > address(this).balance) revert InsufficientFee();
            BRIDGE.deposit{value: fees[i]}(
                destinationDomainIDs[i],
                RESOURCE_ID,
                depositData,
                ""
            );
            emit DeployRequested(msg.sender, fortifiedSalt, destinationDomainIDs[i]);
        }
        if (address(this).balance > 0) revert ExcessFee();
    }

    /**
        @notice Returns total amount of native currency needed for a deploy request.
        @param initCode Contract deploy bytecode.
        @param gasLimit Contract deploy and init gas.
        @param salt Entropy for contract address generation.
        @param isUniquePerChain True to have unique addresses on every chain.
        @param constructorArgs Bytes to add to the initCode, or empty, one per chain.
        @param initDatas Bytes to send to the contract after deployment, or empty, one per chain.
        @param destinationDomainIDs Sygma Domain IDs of target chains.
     */
    function calculateDeployFee(
        bytes calldata initCode,
        uint gasLimit,
        bytes32 salt,
        bool isUniquePerChain,
        bytes[] memory constructorArgs,
        bytes[] memory initDatas,
        uint8[] memory destinationDomainIDs
    ) external view returns (uint[] memory fees) {
        uint len = constructorArgs.length;
        if (len != initDatas.length ||
            len != destinationDomainIDs.length) revert InvalidLength();
        bytes32 fortifiedSalt = fortify(msg.sender, salt, isUniquePerChain);
        IFeeHandler feeHandler = BRIDGE._feeHandler();
        fees = new uint[](len);
        for (uint i = 0; i < len; ++i) {
            if (destinationDomainIDs[i] == DOMAIN_ID) {
                continue;
            }
            bytes memory depositData = prepareDepositData(
                gasLimit,
                abi.encodePacked(initCode, constructorArgs[i]),
                initDatas[i],
                fortifiedSalt
            );
            (fees[i], ) = feeHandler.calculateFee(
                address(this),
                DOMAIN_ID,
                destinationDomainIDs[i],
                RESOURCE_ID,
                depositData,
                ""
            );
        }
        return fees;
    }

    /**
        @notice Executes the deploy.
        @notice Only callable by handler.
        @param originDepositor The depositor from the origin chain. Must be this contract address.
        @param initCode Contract deploy bytecode.
        @param initData Bytes to send to the contract after deployment, or empty.
        @param fortifiedSalt Entropy for contract address generation.
     */
    function execute(address originDepositor, bytes calldata initCode, bytes calldata initData, bytes32 fortifiedSalt) external onlyHandler {
        if (originDepositor != address(this)) revert InvalidOrigin();
        deploy(initCode, initData, fortifiedSalt);
    }

    function deploy(bytes memory initCode, bytes memory initData, bytes32 fortifiedSalt) internal {
        address newContract;
        if (initData.length == 0) {
            newContract = FACTORY.deployCreate3(fortifiedSalt, initCode);
        } else {
            newContract = FACTORY.deployCreate3AndInit(fortifiedSalt, initCode, initData, ICreateX.Values(0, 0));
        }
        emit Deployed(fortifiedSalt, newContract);
    }

    function slice(bytes calldata input, uint256 position) public pure returns (bytes memory) {
        return input[position:];
    }

    /**
        @notice Transforms the provided salt into CreateX permissioned deploy salt.
        @notice Should be used to generate fortifiedSalt that will be emitted in the Deployed events.
        @param sender Address that requested deploy.
        @param salt Entropy for contract address generation.
        @param isUniquePerChain True to have unique addresses on every chain.
        @return Transformed entropy for contract address generation.
     */
    function fortify(address sender, bytes32 salt, bool isUniquePerChain) public view returns(bytes32) {
        return bytes32(abi.encodePacked(
            address(this),
            uint8(isUniquePerChain ? 1 : 0),
            bytes11(keccak256(abi.encodePacked(sender, salt)))
        ));
    }

    /**
        @notice Computes the address where the contract will be deployed on this chain.
        @param sender Address that requested deploy.
        @param salt Entropy for contract address generation.
        @param isUniquePerChain True to have unique addresses on every chain.
        @return Address where the contract will be deployed on this chain.
     */
    function computeContractAddress(address sender, bytes32 salt, bool isUniquePerChain) external view returns(address) {
        return computeContractAddressForChain(sender, salt, isUniquePerChain, block.chainid);
    }

    /**
        @notice Computes the address where the contract will be deployed on specified chain.
        @param sender Address that requested deploy.
        @param salt Entropy for contract address generation.
        @param isUniquePerChain True to have unique addresses on every chain.
        @return Address where the contract will be deployed on specified chain.
     */
    function computeContractAddressForChain(address sender, bytes32 salt, bool isUniquePerChain, uint chainId) public view returns(address) {
        bytes32 guardedSalt;
        bytes32 fortifiedSalt = fortify(sender, salt, isUniquePerChain);
        if (isUniquePerChain) {
            guardedSalt = keccak256(abi.encode(address(this), chainId, fortifiedSalt));
        } else {
            guardedSalt = keccak256(abi.encode(address(this), fortifiedSalt));
        }
        return FACTORY.computeCreate3Address(guardedSalt);
    }

    /**
        After the deposit call to the Bridge, PermissionlessDepositHandler repacks the data and adds the depositor address.
        When reference types are passed into the adapter,
        it's necessary to pack them together with some address to get proper offsets,
        and then the data is passed without the address.
        The address is verified and added later, in the PermissionlessDepositHandler
     */
    function prepareDepositData(
        uint gasLimit,
        bytes memory initCode,
        bytes memory initData,
        bytes32 fortifiedSalt
    ) public view returns (bytes memory) {
        bytes memory encoded = abi.encode(address(0), initCode, initData, fortifiedSalt);
        return abi.encodePacked(
            gasLimit,               // uint256 maxFee
            uint16(4),              // uint16 len(executeFuncSignature)
            this.execute.selector,  // bytes executeFuncSignature
            uint8(20),              // uint8 len(executeContractAddress)
            address(this),          // bytes executeContractAddress
            uint8(20),              // uint8 len(executionDataDepositor)
            address(this),          // bytes executionDataDepositor
            this.slice(encoded, 32) // bytes executionData
        );
    }
}
