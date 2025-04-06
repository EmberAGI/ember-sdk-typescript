import * as dotenv from "dotenv";
import { MockLendingToolDataProvider, DynamicApiAAVEAgent } from "./agent";
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

  await agent.start();
}

main();
