// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.20;

/**
    @title Interface to be used with fee handlers.
    @author ChainSafe Systems.
 */
interface IFeeHandler {
    function calculateFee(
        address sender,
        uint8 fromDomainID,
        uint8 destinationDomainID,
        bytes32 resourceID,
        bytes calldata depositData,
        bytes calldata feeData
    ) external view returns(uint256, address);
}
