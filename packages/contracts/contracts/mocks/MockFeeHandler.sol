// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.20;

import "../interfaces/IFeeHandler.sol";

contract MockFeeHandler is IFeeHandler {
    function calculateFee(
        address /*sender*/,
        uint8 /*fromDomainID*/,
        uint8 destinationDomainID,
        bytes32 /*resourceID*/,
        bytes calldata /*depositData*/,
        bytes calldata /*feeData*/
    ) external pure override returns(uint256, address) {
        return (0.01 ether / destinationDomainID, address(0));
    }
}
