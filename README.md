# Chainsafe's Hardhat Plugin for Multichain deployment with Sygma

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Getting Started](#getting-started)
4. [Building and Running the Snap](#building-and-running-the-snap)
5. [Testing](#testing)
6. [Linting and Formatting](#linting-and-formatting)

<a name="introduction"></a>
## Introduction

Unleash the potential of multi-chain deployment with Hardhat and Sygma: the essential plugin for deploying Ethereum smart contracts with ease and efficiency. Elevate your blockchain development with this powerful, streamlined solution.

<a name="prerequisites"></a>
## Prerequisites

Before you can start working with the project, make sure you have the following software installed:

- [nvm](https://github.com/nvm-sh/nvm) (or you can use [Node.js](https://nodejs.org/) 18)
- [corepack](https://github.com/nodejs/corepack)
    - will enable [yarn](https://yarnpkg.com/) 3.x

<a name="getting-started"></a>
## Getting Started

To get started with the project:

1. Clone the repository:
```shell
git clone https://github.com/ChainSafe/hardhat-plugin-multichain-deploy.git
```

2. Navigate to the project root:
```shell
cd hardhat-plugin-multichain-deploy
```

3. Set node to compatible version of project _(skip if you use manual approach)_
```shell
nvm use
```

4. Utilize corepack
```shell
corepack enable
```

5. Install the dependencies
```shell
yarn install
```

<a name="building-and-running-the-snap"></a>
## Building and Running the Snap

To build and run the project, follow these steps:

1. Build all packages:

```shell
yarn build
```

2. Run the MetaMask Snap:

```shell
yarn start
```

<a name="testing"></a>
## Testing

To run tests for all packages:

```shell
yarn test
```

<a name="linting-and-formatting"></a>
## Linting and Formatting

This project uses [ESLint](https://eslint.org/) to enforce code style and formatting. To check code quality with the linter, run:

```shell
yarn lint
```

To lint and format the code, run:

```shell
yarn lint:style:fix
```
