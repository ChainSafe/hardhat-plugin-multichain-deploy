// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.20;

import "./IFeeHandler.sol";

/**
    @title Interface for Bridge contract.
    @author ChainSafe Systems.
 */
interface IBridge {
    function _domainID() external view returns (uint8);
    function _resourceIDToHandlerAddress(bytes32 resourceID) external view returns (address);
    function _feeHandler() external view returns (IFeeHandler);
    function deposit(
        uint8 destinationDomainID,
        bytes32 resourceID,
        bytes calldata depositData,
        bytes calldata feeData
    ) external payable returns (uint64 depositNonce, bytes memory handlerResponse);
}
