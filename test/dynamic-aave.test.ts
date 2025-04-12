/// <reference types="mocha" />
import { expect } from "chai";
import dotenv from "dotenv";
import { ethers } from "ethers";
import {
  EmberClient,
  EmberGrpcClient,
  GetWalletPositionsResponse,
} from "@emberai/sdk-typescript";
import { DynamicApiAAVEAgent } from "../examples/dynamic-aave-agent/agent";
import { DynamicAPIDispatcher } from "../examples/dynamic-aave-agent/dispatcher";
import { ensureWethBalance } from "./helpers/weth";

dotenv.config();

/// THESE TESTS ARE ALMOST THE SAME AS ./aave.test.ts
/// (but use the dynamic API agent).
/// You probably want to update both.
/// Additionally, there are tests with mocked data that cover edge cases
/// for the dynamic API

describe("Integration tests for AAVE using Dynamic API", function () {
  this.timeout(50_000);

  let wallet: ethers.Wallet;

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("MNEMONIC not found in the environment.");
  }

  const emberEndpoint = process.env.TEST_EMBER_ENDPOINT;
  if (!emberEndpoint) {
    throw new Error("TEST_EMBER_ENDPOINT not found in the environment.");
  }

  const wethAddress = process.env.WETH_ADDRESS;
  if (!wethAddress) {
    throw new Error("WETH_ADDRESS not found in the environment.");
  }

  let provider: ethers.providers.JsonRpcProvider;
  let client: EmberClient;
  let agent: DynamicApiAAVEAgent;

  // Get wallet lending positions
  // TODO: once we add more adapters, this may end up using wrong data
  // because we don't filter by adapter here
  const getReserveOfToken = async (name: string) => {
    const positionsResponse = (await client.getWalletPositions({
      walletAddress: wallet.address,
    })) as GetWalletPositionsResponse;

    for (const position of positionsResponse.positions) {
      if (!position.lendingPosition) continue;
      for (const reserve of position.lendingPosition.userReserves) {
        if (reserve.token.name == name || reserve.token.symbol == name) {
          return reserve;
        }
      }
    }

    return null;
  };

  this.beforeAll(async () => {
    const rpcUrl = process.env.TEST_RPC_URL;
    if (!rpcUrl) {
      console.error("Please set the TEST_RPC_URL environment variable.");
      process.exit(1);
    }
    try {
      provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber();
    } catch (e) {
      console.error(e);
      throw new Error(
        "Failed to connect, did you run `pnpm run start:anvil` first?",
      );
    }
    wallet = ethers.Wallet.fromMnemonic(mnemonic);
    const signer = wallet.connect(provider);
    client = new EmberGrpcClient(emberEndpoint);
    const dispatcher = new DynamicAPIDispatcher(client, {
      [await signer.getChainId()]: signer,
    });
    agent = DynamicApiAAVEAgent.newUsingEmberClient(client, dispatcher);
    await ensureWethBalance(signer, "1", wethAddress);
  });

  this.afterAll(async () => {
    await agent.stop();
  });

  it("should be able to describe what it can do", async () => {
    const response = await agent.processUserInput("What can you do?");
    expect(response.content?.toLowerCase()).to.contain("borrow");
  });

  it("supply some WETH", async () => {
    const amountToSupply = "0.01";

    // Get original balance
    const oldReserve = await getReserveOfToken("WETH");

    await agent.processUserInput(`I want to supply`);
    await agent.processUserInput(`${amountToSupply} of WETH`);
    await agent.processUserInput("on Arbitrum one");

    // Check the new balance increased
    const newReserve = await getReserveOfToken("WETH");
    expect(parseFloat(oldReserve.underlyingBalance)).to.be.closeTo(
      parseFloat(newReserve.underlyingBalance) - parseFloat(amountToSupply),
      0.00001,
    );
  });

  // Depends on the above test for collateral
  it("borrow some WETH", async () => {
    const amountToBorrow = "0.005";

    // Get original balance
    const oldReserve = await getReserveOfToken("WETH");

    // Borrow some WETH
    await agent.processUserInput(
      `borrow ${amountToBorrow} WETH on arbitrum one`,
    );

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check the new borrow amount increase
    const newReserve = await getReserveOfToken("WETH");
    expect(parseFloat(oldReserve.totalBorrows)).to.be.closeTo(
      parseFloat(newReserve.totalBorrows) - parseFloat(amountToBorrow),
      0.00001,
    );
  });

  // Not implemented

  // it("show my positions", async () => {
  //   await agent.processUserInput(`show my positions`);
  // });

  // Depends on the above test (the loan must exist)
  it("repay some WETH", async () => {
    const amountToRepay = "0.005";

    // Get original balance
    const oldReserve = await getReserveOfToken("WETH");

    await agent.processUserInput(`repay ${amountToRepay} WETH on arbitrum one`);

    // Check the new borrow amount decrease
    const newReserve = await getReserveOfToken("WETH");
    expect(parseFloat(oldReserve.totalBorrows)).to.be.closeTo(
      parseFloat(newReserve.totalBorrows) + parseFloat(amountToRepay),
      0.00001,
    );
  });

  // Depends on the above test (the deposit must exist)
  it("withdraw some WETH", async () => {
    const amountToWithdraw = "0.004";

    // Get original balance
    const oldReserve = await getReserveOfToken("WETH");

    await agent.processUserInput(
      `withdraw ${amountToWithdraw} WETH on arbitrum one`,
    );

    // Check the new balance amount decrease
    const newReserve = await getReserveOfToken("WETH");
    expect(parseFloat(oldReserve.underlyingBalance)).to.be.closeTo(
      parseFloat(newReserve.underlyingBalance) + parseFloat(amountToWithdraw),
      0.00001,
    );
  });
});
