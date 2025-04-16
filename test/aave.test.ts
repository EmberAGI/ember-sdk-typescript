/// <reference types="mocha" />
import { expect } from "chai";
import dotenv from "dotenv";
import { ethers } from "ethers";
import {
  EmberClient,
  EmberGrpcClient,
  GetWalletPositionsResponse,
} from "@emberai/sdk-typescript";
import { Agent } from "../examples/aave-agent/agent";
import { ensureWethBalance } from "./helpers/weth";
import { CHAIN_CONFIGS } from "./chains";
import { MultiChainSigner } from "./multichain-signer";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.tmp.test" });

describe("Integration tests for AAVE", async function () {
  this.timeout(50_000);

  let wallet: ethers.Wallet;

  const signer = await MultiChainSigner.fromEnv();

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
  let agent: Agent;

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

    client = new EmberGrpcClient(emberEndpoint);

    agent = new Agent(client, signer, wallet.address);
    // Mute logs
    agent.log = async () => {};
    await agent.init();
    await ensureWethBalance(signer, "1", wethAddress);
  });

  this.afterAll(async () => {
    await agent.stop();
  });

  it("should be able to describe what it can do", async () => {
    const response = await agent.processUserInput("What can you do?");
    expect(response.content.toLowerCase()).to.contain("borrow");
  });

  it("supply some WETH", async () => {
    const amountToSupply = "0.01";

    // Get original balance
    const oldReserve = await getReserveOfToken("WETH");

    // supply some WETH
    const response = await agent.processUserInput(
      `supply ${amountToSupply} WETH`,
    );
    expect(response.function_call!.name).to.be.equal("supply");
    expect(JSON.parse(response.function_call!.arguments)).to.be.deep.equal({
      tokenName: "Wrapped ETH",
      amount: amountToSupply,
    });

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
    const response = await agent.processUserInput(
      `borrow ${amountToBorrow} WETH`,
    );
    expect(response.function_call!.name).to.be.equal("borrow");
    expect(JSON.parse(response.function_call!.arguments)).to.be.deep.equal({
      tokenName: "Wrapped ETH",
      amount: amountToBorrow,
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check the new borrow amount increase
    const newReserve = await getReserveOfToken("WETH");
    expect(parseFloat(oldReserve.totalBorrows)).to.be.closeTo(
      parseFloat(newReserve.totalBorrows) - parseFloat(amountToBorrow),
      0.000001,
    );
  });

  it("show my positions", async () => {
    // Just to make sure there are no exceptions
    await agent.processUserInput(`show my positions`);
  });

  // Depends on the above test (the loan must exist)
  it("repay some WETH", async () => {
    const amountToRepay = "0.005";

    // Get original balance
    const oldReserve = await getReserveOfToken("WETH");

    const response = await agent.processUserInput(
      `repay ${amountToRepay} WETH`,
    );
    expect(response.function_call!.name).to.be.equal("repay");
    expect(JSON.parse(response.function_call!.arguments)).to.be.deep.equal({
      tokenName: "Wrapped ETH",
      amount: amountToRepay,
    });

    // Check the new borrow amount decrease
    const newReserve = await getReserveOfToken("WETH");
    expect(parseFloat(oldReserve.totalBorrows)).to.be.closeTo(
      parseFloat(newReserve.totalBorrows) + parseFloat(amountToRepay),
      0.000001,
    );
  });

  // Depends on the above test (the deposit must exist)
  it("withdraw some WETH", async () => {
    const amountToWithdraw = "0.004";

    // Get original balance
    const oldReserve = await getReserveOfToken("WETH");

    const response = await agent.processUserInput(
      `withdraw ${amountToWithdraw} WETH`,
    );
    expect(response.function_call!.name).to.be.equal("withdraw");
    expect(JSON.parse(response.function_call!.arguments)).to.be.deep.equal({
      tokenName: "Wrapped ETH",
      amount: amountToWithdraw,
    });

    // Check the new balance amount decrease
    const newReserve = await getReserveOfToken("WETH");
    expect(parseFloat(oldReserve.underlyingBalance)).to.be.closeTo(
      parseFloat(newReserve.underlyingBalance) + parseFloat(amountToWithdraw),
      0.000001,
    );
  });
});
