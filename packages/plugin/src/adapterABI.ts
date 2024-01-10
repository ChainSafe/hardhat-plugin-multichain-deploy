export const AdapterABI = [
  {
    inputs: [
      {
        internalType: "contract ICreateX",
        name: "factory",
        type: "address",
      },
      {
        internalType: "contract IBridge",
        name: "bridge",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "resourceID",
        type: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "ExcessFee",
    type: "error",
  },
  {
    inputs: [],
    name: "InsufficientFee",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidHandler",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidLength",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidOrigin",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "fortifiedSalt",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "destinationDomainID",
        type: "uint8",
      },
    ],
    name: "DeployRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "fortifiedSalt",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "address",
        name: "newContract",
        type: "address",
      },
    ],
    name: "Deployed",
    type: "event",
  },
  {
    inputs: [],
    name: "BRIDGE",
    outputs: [
      {
        internalType: "contract IBridge",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DOMAIN_ID",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "FACTORY",
    outputs: [
      {
        internalType: "contract ICreateX",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "RESOURCE_ID",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "initCode",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "gasLimit",
        type: "uint256",
      },
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
      {
        internalType: "bool",
        name: "isUniquePerChain",
        type: "bool",
      },
      {
        internalType: "bytes[]",
        name: "constructorArgs",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "initDatas",
        type: "bytes[]",
      },
      {
        internalType: "uint8[]",
        name: "destinationDomainIDs",
        type: "uint8[]",
      },
    ],
    name: "calculateDeployFee",
    outputs: [
      {
        internalType: "uint256[]",
        name: "fees",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
      {
        internalType: "bool",
        name: "isUniquePerChain",
        type: "bool",
      },
    ],
    name: "computeContractAddress",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
      {
        internalType: "bool",
        name: "isUniquePerChain",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "chainId",
        type: "uint256",
      },
    ],
    name: "computeContractAddressForChain",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "initCode",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "gasLimit",
        type: "uint256",
      },
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
      {
        internalType: "bool",
        name: "isUniquePerChain",
        type: "bool",
      },
      {
        internalType: "bytes[]",
        name: "constructorArgs",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "initDatas",
        type: "bytes[]",
      },
      {
        internalType: "uint8[]",
        name: "destinationDomainIDs",
        type: "uint8[]",
      },
      {
        internalType: "uint256[]",
        name: "fees",
        type: "uint256[]",
      },
    ],
    name: "deploy",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "originDepositor",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "initCode",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "initData",
        type: "bytes",
      },
      {
        internalType: "bytes32",
        name: "fortifiedSalt",
        type: "bytes32",
      },
    ],
    name: "execute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
      {
        internalType: "bool",
        name: "isUniquePerChain",
        type: "bool",
      },
    ],
    name: "fortify",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gasLimit",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "initCode",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "initData",
        type: "bytes",
      },
      {
        internalType: "bytes32",
        name: "fortifiedSalt",
        type: "bytes32",
      },
    ],
    name: "prepareDepositData",
    outputs: [
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "input",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "position",
        type: "uint256",
      },
    ],
    name: "slice",
    outputs: [
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
] as const;
