import * as dotenv from "dotenv";
import { MockLendingToolDataProvider } from "./data-provider";
import { DynamicApiAAVEAgent } from "./agent";
import {
  LLMLendingToolOpenAI
} from "../../onchain-actions/build/src/services/api/dynamic/llm-lending-tool.js";
import chalk from "chalk";

dotenv.config();

async function main() {
  const dataProvider = new MockLendingToolDataProvider({
    WETH: ["Arbitrum", "Base", "Ethereum"],
    WBTC: ["Arbitrum", "Ethereum"],
    ARB: ["Arbitrum"],
  });

  const llmLendingTool = new LLMLendingToolOpenAI();

  console.log("This agent works on mocked data. No transactions will be issued");
  const agent = DynamicApiAAVEAgent.newMock(dataProvider, llmLendingTool);
  agent.log = async () => {};
  llmLendingTool.log = async () => {};
  agent.dispatch = console.log.bind(console, chalk.greenBright("[dispatching]"));
  await agent.start();
}

main();
