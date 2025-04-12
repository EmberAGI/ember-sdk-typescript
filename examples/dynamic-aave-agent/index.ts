import * as dotenv from "dotenv";
import { DynamicApiAAVEAgent } from "./agent";
import chalk from "chalk";
import { EmberGrpcClient } from "@emberai/sdk-typescript";
import { DynamicAPIDispatcher } from "./dispatcher";
import { ethers } from "ethers";

dotenv.config();

async function main() {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("MNEMONIC not provided");
  }

  const rpc = process.env.TEST_RPC_URL;
  if (!rpc) {
    throw new Error("TEST_RPC_URL not provided");
  }

  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  console.log(`Using wallet ${wallet.address}`);

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const signer = wallet.connect(provider);
  const endpoint =
    process.env.TEST_EMBER_ENDPOINT ||
    (() => {
      throw new Error("TEST_EMBER_ENDPOINT not set!");
    })();
  const client = new EmberGrpcClient(endpoint);
  const dispatcher = new DynamicAPIDispatcher(client, signer);
  const agent = DynamicApiAAVEAgent.newUsingEmberClient(client, dispatcher);
  console.log(`This agent uses ${rpc} to send transactions`);
  agent.addListener("dispatch", (payload) =>
    console.log(chalk.greenBright("[dispatching]"), payload),
  );
  agent.addListener("payloadUpdated", (payload) => {
    const params = Object.entries(payload).filter(
      ([_, value]) => typeof value !== "undefined",
    );
    if (params.length) {
      console.log(
        chalk.bold("[parameters]"),
        "\n",
        params
          .map(([param, value]) => chalk.yellowBright(param) + ": " + value)
          .join("\n "),
      );
    }
  });
  agent.addListener("assistantResponse", (content) =>
    console.log(chalk.whiteBright.bold("[assistant]:"), content),
  );
  await agent.start();
}

main();
