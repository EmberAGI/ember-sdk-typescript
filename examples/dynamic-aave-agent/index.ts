import * as dotenv from "dotenv";
import { MockLendingToolDataProvider, LLMLendingToolOpenAI, DynamicApiAgent } from './agent';

dotenv.config();

async function main () {
  const dataProvider = new MockLendingToolDataProvider({
      "WETH": ["Arbitrum", "Base", "Ethereum"],
      "WBTC": ["Arbitrum", "Ethereum"],
      "ARB": ["Arbitrum"],
    });

  const llmLendingTool = new LLMLendingToolOpenAI();

  const agent = new DynamicApiAgent(
    dataProvider,
    llmLendingTool
  );

  await agent.start();
}

main();
