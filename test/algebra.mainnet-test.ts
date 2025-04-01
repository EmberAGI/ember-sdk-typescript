/// <reference types="mocha" />
import { assert, expect } from "chai";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { EmberClient, EmberGrpcClient } from "@emberai/sdk-typescript";
import { Agent } from "../examples/camelot-agent/agent";
import { ensureWethBalance } from "./helpers/weth";
import { ERC20Wrapper } from "./helpers/erc20";

dotenv.config();

describe("Integration tests for Algebra (Camelot) on mainnet", function () {
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
  let agent: Agent;
  let usdc: ERC20Wrapper;

  this.beforeAll(async () => {
    const rpcUrl = process.env.ETH_RPC_URL;
    if (!rpcUrl) {
      throw new Error("ETH_RPC_URL not found in the environment.");
    }
    try {
      provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber();
    } catch (e) {
      console.error(e);
      throw new Error(
        "Failed to connect, did you run `pnpm run start:mainnet` first?",
      );
    }
    wallet = ethers.Wallet.fromMnemonic(mnemonic);
    const signer = wallet.connect(provider);
    client = new EmberGrpcClient(emberEndpoint);
    agent = new Agent(client, signer, wallet.address);
    // Mute logs
    agent.log = async () => {};
    await agent.init();
    await ensureWethBalance(signer, "0.0005", wethAddress);

    const USDC_CA = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
    usdc = new ERC20Wrapper(provider, USDC_CA);
  });

  this.afterAll(async () => {
    await agent.stop();
  });

  it("should be able to describe what it can do", async () => {
    const response = await agent.processUserInput("What can you do?");
    expect(response.content.toLowerCase()).to.contain("liquidity");
  });

  it("close all positions", async () => {
    while (true) {
      const response = await agent.processUserInput("Show current positions");
      if (response.content.includes("No liquidity positions found")) {
        break;
      }
      await agent.processUserInput("Close the last position");
    }
  });

  it("should be able to deposit liquidity", async () => {
    await agent.processUserInput("list liquidity pools");
    const priceStr = await agent.processUserInput(
      "print the price of the WETH/USDC liquidity pool without any extra output. Just the price number.",
    );
    const price = parseFloat(priceStr.content);
    const usdcBalanceBefore = await usdc.balanceOf(wallet.address);
    const targetUSDCAmount = 1;
    const depositResponse = await agent.processUserInput(
      `Deposit ${targetUSDCAmount} USDC and ${(targetUSDCAmount / price).toFixed(6)} ETH within the range from ${(price * 0.8).toFixed(6)} to ${(price * 1.3).toFixed(6)}`,
    );
    assert.include(depositResponse.content.toLowerCase(), "done");
    const usdcBalanceAfter = await usdc.balanceOf(wallet.address);
    assert(
      usdcBalanceBefore.sub(usdcBalanceAfter).gt(0),
      "USDC balance decreased",
    );
    console.log(
      "consumed USDC:",
      usdcBalanceBefore.sub(usdcBalanceAfter).div(1000000).toString(),
    );
  });

  it("should be able to list positions", async () => {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const response = await agent.processUserInput("Show current positions");
    assert.include(response.content, "WETH/USDC");
  });

  it("close the position", async () => {
    await agent.processUserInput("Close the last position");
  });
});
