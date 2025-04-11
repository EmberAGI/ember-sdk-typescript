import * as dotenv from "dotenv";
import { DynamicApiAAVEAgent } from "./agent";
import chalk from "chalk";
import { EmberGrpcClient } from "@emberai/sdk-typescript";

dotenv.config();

async function main() {
  const endpoint = process.env.TEST_EMBER_ENDPOINT || (() => {
    throw new Error("TEST_EMBER_ENDPOINT not set!");
  })();
  const client = new EmberGrpcClient(endpoint);
  const agent = DynamicApiAAVEAgent.newUsingEmberClient(client);
  agent.log = async () => {};
  agent.dispatch = console.log.bind(console, chalk.greenBright("[dispatching]"));
  await agent.start();
}

main();
