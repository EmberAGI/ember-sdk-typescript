/// <reference types="mocha" />
import { assert, expect } from "chai";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { EmberClient, EmberHttpClient } from "@emberai/sdk-typescript";
import { Agent } from "../examples/camelot-agent/agent";
import { ensureWethBalance } from "./helpers/weth";
import { mintUSDC } from "./helpers/mint-usdc";
import { ERC20Wrapper } from "./helpers/erc20";

dotenv.config();

describe("Integration tests for Algebra (Camelot)", function () {
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
    const rpcUrl = process.env.TEST_RPC_URL;
    if (!rpcUrl) {
      throw new Error("TEST_RPC_URL not found in the environment.");
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
    client = new EmberHttpClient(emberEndpoint);
    agent = new Agent(client, signer, wallet.address);
    // Mute logs
    agent.log = async () => {};
    await agent.init();
    await ensureWethBalance(signer, "1", wethAddress);

    const USDC_CA = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
    await mintUSDC({
      provider,
      tokenAddress: USDC_CA,
      userAddress: signer.address,
      balanceStr: (1000_000_000).toString(),
    });
    usdc = new ERC20Wrapper(provider, USDC_CA);
  });

  this.afterAll(async () => {
    await agent.stop();
  });

  it("should be able to describe what it can do", async () => {
    const response = await agent.processUserInput("What can you do?");
    expect(response.content.toLowerCase()).to.contain("liquidity");
  });

  it("should be able to list pools", async () => {
    const response = await agent.processUserInput("list pools");
    expect(response.content).to.contain("Liquidity pools");
  });

  it("should be able to deposit liquidity", async () => {
    await agent.processUserInput("list liquidity pools");
    const priceStr = await agent.processUserInput(
      "print the price of the WETH/USDC liquidity pool without any extra output. Just the price number.",
    );
    const price = parseFloat(priceStr.content);
    const usdcBalanceBefore = await usdc.balanceOf(wallet.address);
    const targetUSDCAmount = 100;
    const depositResponse = await agent.processUserInput(
      `Deposit ${targetUSDCAmount} USDC and ${(targetUSDCAmount / price).toFixed(6)} ETH within the range from ${(price * 0.8).toFixed(6)} to ${(price * 1.3).toFixed(6)}`,
    );
    assert.include(depositResponse.content.toLowerCase(), "done");
    const usdcBalanceAfter = await usdc.balanceOf(wallet.address);
    assert(
      usdcBalanceBefore.sub(usdcBalanceAfter).gt(0),
      "USDC balance decreased",
    );
  });

  // We know that the newly created position does not appear due to
  //https://github.com/EmberAGI/ember-sdk-typescript/issues/23
  // but we still check for exceptions
  it("should be able to list positions", async () => {
    const _response = await agent.processUserInput("Show current positions");
  });
});
