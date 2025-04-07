import * as dotenv from "dotenv";
import { MockLendingToolDataProvider } from "./data-provider";
import { DynamicApiAAVEAgent } from "./agent";
import { LLMLendingToolOpenAI } from "./llm-lending-tool";

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
  await agent.start();
}

main();
