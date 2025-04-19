/// <reference types="mocha" />
import { assert, expect } from "chai";
import dotenv from "dotenv";
import { EmberClient, EmberGrpcClient } from "@emberai/sdk-typescript";
import { Agent } from "../examples/camelot-agent/agent";
import { ensureWethBalance } from "./helpers/weth";
import { ERC20Wrapper } from "./helpers/erc20";
import { MultiChainSigner } from "./multichain-signer";
import { ChainConfig } from "./chains";

dotenv.config();

const MAINNET_TEST_CHAIN = process.env.MAINNET_TEST_CHAIN;

if (!MAINNET_TEST_CHAIN) {
  throw new Error("MAINNET_TEST_CHAIN not found in the environment.");
}

describe(
  "Integration tests for Algebra (Camelot) on " + MAINNET_TEST_CHAIN,
  function () {
    this.timeout(50_000);

    const emberEndpoint = process.env.TEST_EMBER_ENDPOINT;
    if (!emberEndpoint) {
      throw new Error("TEST_EMBER_ENDPOINT not found in the environment.");
    }

    let client: EmberClient;
    let agent: Agent;
    let anotherToken: ERC20Wrapper;
    let chainConfig: ChainConfig;
    let signer: MultiChainSigner;

    this.beforeAll(async () => {
      signer = await MultiChainSigner.fromEnv();
      client = new EmberGrpcClient(emberEndpoint);
      agent = new Agent(client, signer);
      await agent.init();
      const [chainId, cfg] = signer.getChainByVarName(MAINNET_TEST_CHAIN);
      chainConfig = cfg;

      if (!chainConfig.wrappedNativeToken) {
        throw new Error(
          `Chain ${MAINNET_TEST_CHAIN} does not have a wrappedNativeToken specified, edit test/chains.ts`,
        );
      }

      if (!chainConfig.anotherToken) {
        throw new Error(
          `Chain ${MAINNET_TEST_CHAIN} does not have anotherToken specified, edit test/chains.ts`,
        );
      }

      await ensureWethBalance(
        signer.getSignerForChainId(chainId),
        "0.0005",
        chainConfig.wrappedNativeToken.address,
      );

      anotherToken = new ERC20Wrapper(
        signer.getSignerForChainId(chainId).provider!,
        chainConfig.anotherToken.address,
      );
    });

    this.afterAll(async () => {
      await agent.stop();
    });

    it("should be able to describe what it can do", async () => {
      const response = await agent.processUserInput("What can you do?");
      expect(response.content.toLowerCase()).to.contain("liquidity");
    });

    it("close all positions", async () => {
      let counter = 5;
      while (true) {
        const response = await agent.processUserInput("Show current positions");
        if (response.content.includes("No liquidity positions found")) {
          break;
        }
        await agent.processUserInput("Close the last position");
        if (counter-- <= 0) throw new Error("Reached the limit of iterations");
      }
    });

    it("should be able to deposit liquidity", async () => {
      await agent.processUserInput("list liquidity pools");
      const priceStr = await agent.processUserInput(
        `print the price of the ${chainConfig.wrappedNativeToken!.name}/${chainConfig.anotherToken!.name} liquidity pool without any extra output. Just the price number.`,
      );
      const price = parseFloat(priceStr.content);
      const anotherTokenBalanceBefore = await anotherToken.balanceOf(
        signer.wallet.address,
      );
      const targetTokenAmount = 0.05;
      const depositResponse = await agent.processUserInput(
        `Deposit ${targetTokenAmount} ${chainConfig.anotherToken!.name} and ${(targetTokenAmount / price).toFixed(6)} ${chainConfig.wrappedNativeToken!.name} within the range from ${(price * 0.8).toFixed(6)} to ${(price * 1.3).toFixed(6)}`,
      );
      assert.include(depositResponse.content.toLowerCase(), "done");
      const anotherTokenBalanceAfter = await anotherToken.balanceOf(
        signer.wallet.address,
      );
      assert(
        anotherTokenBalanceBefore.sub(anotherTokenBalanceAfter).gt(0),
        "token balance decreased",
      );

      console.log(
        "consumed token amount:",
        anotherTokenBalanceBefore.sub(anotherTokenBalanceAfter).toString(),
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
  },
);
