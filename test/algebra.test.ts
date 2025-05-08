/// <reference types="mocha" />
import { assert, expect } from "chai";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { EmberClient, EmberGrpcClient } from "@emberai/sdk-typescript";
import { Agent } from "../examples/camelot-agent/agent";
import { ensureWethBalance } from "./helpers/weth";
import { mintUSDC } from "./helpers/mint-usdc";
import { ERC20Wrapper } from "./helpers/erc20";
import { MultiChainSigner } from "./multichain-signer";
import { CHAIN_CONFIGS } from "./chains";

dotenv.config();

// Define chain IDs that should be tested
// Using available chains from the test environment
const CHAINS_TO_TEST: number[] = [42161]; // Arbitrum One for Camelot

describe("Integration tests for Algebra (Camelot)", function () {
  this.timeout(50_000);

  let multiChainSigner: MultiChainSigner;
  let client: EmberClient;

  const emberEndpoint = process.env.TEST_EMBER_ENDPOINT;
  if (!emberEndpoint) {
    throw new Error("TEST_EMBER_ENDPOINT not found in the environment.");
  }

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("MNEMONIC not found in the environment.");
  }

  before(async function () {
    try {
      // Create a single MultiChainSigner for all chains being tested
      multiChainSigner = await MultiChainSigner.fromTestChains(CHAINS_TO_TEST);

      // Initialize Ember client
      client = new EmberGrpcClient(emberEndpoint);
    } catch (error) {
      console.error("Failed to initialize test environment:", error);
      throw error;
    }
  });

  // Create a separate test suite for each chain
  for (const chainId of CHAINS_TO_TEST) {
    describe(`Running tests on ${CHAIN_CONFIGS[chainId]?.name || `Chain ${chainId}`}`, function () {
      let agent: Agent;
      let usdc: ERC20Wrapper;

      before(async function () {
        // Verify that chain configuration exists
        if (!CHAIN_CONFIGS[chainId]) {
          throw new Error(
            `Chain configuration missing for chain ID ${chainId}. Please add it to test/chains.ts.`,
          );
        }

        // Get WETH address from chain config
        const wethAddress = CHAIN_CONFIGS[chainId]?.wrappedNativeToken?.address;
        if (!wethAddress) {
          throw new Error(
            `No wrapped native token (WETH) defined for chain ${chainId}. Please add wrappedNativeToken to the chain configuration in test/chains.ts.`,
          );
        }

        // Get USDC address from chain config
        const usdcAddress = CHAIN_CONFIGS[chainId]?.anotherToken?.address;
        if (!usdcAddress) {
          throw new Error(
            `No secondary token (USDC) defined for chain ${chainId}. Please add anotherToken to the chain configuration in test/chains.ts.`,
          );
        }

        // Create agent for this chain
        agent = new Agent(client, multiChainSigner);

        // Mute logs
        agent.log = async () => {};

        // Initialize agent
        await agent.init();

        // Ensure WETH balance
        const signer = multiChainSigner.getSignerForChainId(chainId);
        await ensureWethBalance(signer, "1", wethAddress);

        // Get provider from signer and ensure it's a JsonRpcProvider
        const provider = signer.provider as ethers.providers.JsonRpcProvider;

        await mintUSDC({
          provider,
          tokenAddress: usdcAddress,
          userAddress: await signer.getAddress(),
          balanceStr: (1000_000_000).toString(),
        });
        usdc = new ERC20Wrapper(provider, usdcAddress);
        // expect((await usdc.balanceOf(await signer.getAddress())).gte(1000_000_000)).to.be.true;
      });

      after(async function () {
        if (agent) {
          await agent.stop();
        }
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
        const usdcBalanceBefore = await usdc.balanceOf(
          await multiChainSigner.getAddress(),
        );
        const targetUSDCAmount = 0.01;
        const depositResponse = await agent.processUserInput(
          `Deposit ${targetUSDCAmount} USDC and ${(targetUSDCAmount / price).toFixed(6)} WETH within the range from ${(price * 0.8).toFixed(6)} to ${(price * 1.3).toFixed(6)}`,
        );
        assert.include(depositResponse.content.toLowerCase(), "done");
        const usdcBalanceAfter = await usdc.balanceOf(
          await multiChainSigner.getAddress(),
        );
        assert(
          usdcBalanceBefore.sub(usdcBalanceAfter).gt(0),
          "USDC balance decreased",
        );
      });

      // We know that the newly created position does not appear due to
      //https://github.com/EmberAGI/ember-sdk-typescript/issues/23
      // but we still check for exceptions
      it("should be able to list positions", async () => {
        const _response = await agent.processUserInput(
          "Show current positions",
        );
      });
    });
  }
});
