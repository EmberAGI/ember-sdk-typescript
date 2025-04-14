import * as dotenv from "dotenv";
import { MockLendingToolDataProvider } from "./data-provider";
import { DynamicApiAAVEAgent } from "./agent";
import { LLMLendingToolOpenAI } from "../../onchain-actions/build/src/services/api/dynamic/llm-lending-tool.js";
import chalk from "chalk";

dotenv.config();

async function main() {
  const data = {
    WETH: ["Arbitrum", "Base", "Ethereum"],
    WBTC: ["Arbitrum", "Ethereum"],
    ARB: ["Arbitrum"],
  };
  const dataProvider = new MockLendingToolDataProvider(data);

  const llmLendingTool = new LLMLendingToolOpenAI();

  console.log(
    "This agent works on mocked data. No transactions will be issued",
  );
  console.log("data:", data);
  const agent = DynamicApiAAVEAgent.newMock(dataProvider, llmLendingTool, {
    dispatch: console.log.bind(console, "dispatching"),
  });
  // agent.log = async () => {};
  // llmLendingTool.log = async () => {};
  agent.dispatch = console.log.bind(
    console,
    chalk.greenBright("[dispatching]"),
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
