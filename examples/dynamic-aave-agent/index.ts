import * as dotenv from "dotenv";
import { MockLendingToolDataProvider } from "./data-provider";
import { DynamicApiAAVEAgent } from "./agent";
import { LLMLendingToolOpenAI } from "./llm-lending-tool";
import chalk from "chalk";

dotenv.config();

async function main() {
  const dataProvider = new MockLendingToolDataProvider({
    WETH: ["Arbitrum", "Base", "Ethereum"],
    WBTC: ["Arbitrum", "Ethereum"],
    ARB: ["Arbitrum"],
  });

  const llmLendingTool = new LLMLendingToolOpenAI();

  const agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
  agent.log = async () => {};
  llmLendingTool.log = async () => {};
  agent.dispatch = console.log.bind(console, chalk.green("[dispatching]"));
  await agent.start();
}

main();
