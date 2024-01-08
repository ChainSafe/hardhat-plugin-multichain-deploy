// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.20;

contract HelloSygma {
    uint public immutable VERSION;
    string public NAME;

    constructor(uint version) {
        VERSION = version;
    }

    function setName(string memory name) external {
        if (bytes(NAME).length > 0) return;
        NAME = name;
    }
}
