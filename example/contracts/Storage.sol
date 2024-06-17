// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Storage {
    mapping(address => uint256) private _storage;

    constructor() {}

    function retrieve(address depositor) public view returns (uint256) {
        return _storage[depositor];
    }

    function store(address depositor, uint256 val) public {
        _storage[depositor] = val;
    }
}
