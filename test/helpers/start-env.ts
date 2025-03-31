import dotenv from "dotenv";
import { definePool, Instance } from "prool";
import { anvil } from "prool/instances";
import { ethers } from "ethers";
import { runCommand } from "./run-command";
import * as process from "process";
import { AnvilOptions } from "@viem/anvil";

dotenv.config();

export const startEnv = async (useAnvil: boolean) => {
  const originalRpcUrl = process.env.ETH_RPC_URL;
  if (!originalRpcUrl) throw new Error("No ETH_RPC_URL provided");

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) throw new Error("Mnemonic not found in the .env file.");

  let rpcUrl: string;

  let instance: null | Instance = null;
  if (useAnvil) {
    const anvilSpec: AnvilOptions = {
      mnemonic: mnemonic,
      forkUrl: originalRpcUrl,
    };

    if (process.env.TEST_ANVIL_FORK_BLOCK_NUMBER) {
      anvilSpec.forkBlockNumber = parseInt(
        process.env.TEST_ANVIL_FORK_BLOCK_NUMBER,
      );
    } else {
      console.info(
        "TEST_ANVIL_FORK_BLOCK_NUMBER not provided, starting from the latest block",
      );
    }

    const pool = definePool({
      instance: anvil(anvilSpec),
    });

    instance = (await pool.start(1, {
      port: parseInt(process.env.ANVIL_PORT || "3070"),
    })) as Instance;

    rpcUrl = `http://${instance.host}:${instance.port}`;
  } else {
    rpcUrl = originalRpcUrl;
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  if (useAnvil) {
    await provider.send("evm_setAutomine", [true]);
  }

  const { chainId } = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();

  process.chdir("onchain-actions");
  process.env.AAVE_RPC_URL = rpcUrl;
  await runCommand(
    "docker compose --progress=plain -f compose.local.yaml up -d --wait",
    "compose",
  );

  // Add some timeout to make sure the memgraph port is available
  await new Promise((resolve) => setTimeout(resolve, 10_000));

  await runCommand("pnpm install", "install");
  try {
    await runCommand("pnpm run dev", "dev", {}, "service running");
  } catch (e) {
    console.error(e);
    throw new Error(
      "Did you forget to populate .env in the onchain-actions/ folder?\nGo to onchain-actions and fix this problem manually: the goal is to be able to run `pnpm run dev`",
    );
  }

  console.log("Chain ID:", chainId);
  console.log("Latest Block Number:", blockNumber);
  console.log();
  if (!useAnvil) {
    console.log("Anvil instance started. Ensure this configuration is used:");
    console.log();
    console.log(`TEST_RPC_URL=${rpcUrl}`);
    if (instance !== null) {
      console.log(`ANVIL_PORT=${instance.port}`);
    }
    console.log();
  }
  // DO NOT EDIT the line below, CI depends on it
  // useAnvil flag purposefully breaks the logic, to ensure we never accidentally
  // run real chain tests in CI.
  console.log(`You can run ${useAnvil ? "" : "mainnet "}integration tests now`);
  console.log();
  if (useAnvil) {
    console.log("pnpm run test");
  } else {
    console.log("pnpm run test:mainnet");
  }
};
