/// <reference types="mocha" />
import { expect } from "chai";
import dotenv from "dotenv";
import { ethers } from "ethers";
import {
  EmberClient,
  EmberGrpcClient,
} from "@emberai/sdk-typescript";
import { Agent } from "../examples/camelot-agent/agent";
import { ensureWethBalance } from "./helpers/weth";

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
    expect(response.content.toLowerCase()).to.contain("liquidity");
  });

});
