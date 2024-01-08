// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.20;

import "../interfaces/IBridge.sol";

contract MockBridge is IBridge {
    address immutable HANDLER;
    address immutable FEE_HANDLER;
    uint8 immutable DOMAIN_ID;
    uint public initialized = 0;

    event Deposit(uint8 destinationDomainID, bytes32 resourceID, bytes depositData, bytes feeData, uint value);

    error AlreadyInitialized();

    constructor (address handler, address feeHandler, uint8 domainId) {
        HANDLER = handler;
        FEE_HANDLER = feeHandler;
        DOMAIN_ID = domainId;
    }

    function _domainID() external view override returns (uint8) {
        return DOMAIN_ID;
    }

    function _resourceIDToHandlerAddress(bytes32 /*resourceID*/) external view override returns (address) {
        return HANDLER;
    }

    function _feeHandler() external view returns (IFeeHandler) {
        return IFeeHandler(FEE_HANDLER);
    }

    function deposit(
        uint8 destinationDomainID,
        bytes32 resourceID,
        bytes calldata depositData,
        bytes calldata feeData
    ) external payable returns (uint64 depositNonce, bytes memory handlerResponse) {
        emit Deposit(destinationDomainID, resourceID, depositData, feeData, msg.value);
        return (0, "");
    }

    function initialize(uint value) external {
        if (initialized > 0) revert AlreadyInitialized();
        initialized = value;
    }
}
