This document is a guide for working with this repo.

# Pre-requisites

- The developer must be familiar with using [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- You will need authorization of your github account to read `onchain-actions` and git ssh access set up.

# Development workflows

This repository uses `onchain-actions`, our proprietary server implementation as a submodule.

## Checking out the repo

- Do not download the source code, run `git clone`
- Run `git submodule update --init --recursive` in the repo directory.

## Switching branches

- Run `git submodule update --init --recursive` every time after you switch branches of the SDK repo. If there is an error, that means the `onchain-actions` has uncommitted changes that conflict with the new revision. Remove them or commit.
- Run `pnpm install` in the root directory of the SDK, and `pnpm install --ignore-workspace` in `onchain-actions` (we actually don't use `onchain-actions` as part of the SDK workspace, but there is a bug in pnpm we need to work around, see [this](https://github.com/pnpm/pnpm/issues/9348#issuecomment-2773242650))
- Whenever you `pnpm install` anything in `onchain-actions`, make sure you are passing `--ignore-workspace` as well to update the lock.
- Run `pnpm run build`
- Make sure to add the updated onchain-actions revision whenever it's changed: `git add onchain-actions`

## Populating `.env`

Both [the root .env](./.env) and [onchain-actions/.env](./onchain-actions/.env) must be populated before you can proceed.

Environment variables take precedence over the `.env` file values, so you can override specific parameters in the shell.

# Testing

## onchain-actions integration tests (legacy)

See [onchain-actions/integration_tests](onchain-actions/integration_tests)

These tests only cover the server functionality, and therefore are less useful than integration tests in the SDK, that cover the server, the client and the chain state.

## Anvil tests

[Anvil](https://github.com/wevm/prool/?tab=readme-ov-file#anvil-execution-node) allows us to run local chain transactions without spending mainnet gas.

### Pre-requisites

Populate `MNEMONIC` in `.env` with a 24-word mnemonic phrase that you don't use for anything else.

### Running

- Run `pnpm run start:anvil` - starts Anvil and points onchain-actions server to it.
- In another shell, run `pnpm run test`

## Mainnet tests

Some of the actions can't be performed on an anvil node.

- For an unknown reason, we can't run some actions for Algebra on Anvil.

- Additionally, some API services we'll depend on in the integration test suite in the future will not be usable with Anvil (because they will not be able to see our local chain state).

For these reasons we decided to simply run tests on mainnet.

### Running

- Populate your `MNEMONIC` in `.env`
- Pre-fund the address that corresponds to that mnemonic with ETH on Arbitrum.
- Run `pnpm run start:mainnet``
- Run `pnpm run test:mainnet``
