import { expect } from "chai";
import dotenv from "dotenv";
import { LendingToolDataProvider } from "../onchain-actions/build/src/services/api/dynamic/aave.js";
import {
  MockLendingToolDataProvider,
  LLMLendingToolOpenAI,
  DynamicApiAgent,
} from "../examples/dynamic-aave-agent/agent";
import permutations from "./helpers/permutations";

dotenv.config();

describe("AAVE Dynamic API agent", function () {
  this.timeout(40_000);

  let agent: DynamicApiAgent;
  let dataProvider: LendingToolDataProvider;
  let llmLendingTool: LLMLendingToolOpenAI;

  this.beforeAll(async () => {
    dataProvider = new MockLendingToolDataProvider({
      WETH: ["Arbitrum", "Base", "Ethereum"],
      WBTC: ["Arbitrum", "Ethereum"],
      ARB: ["Arbitrum"],
    });

    llmLendingTool = new LLMLendingToolOpenAI();

    agent = new DynamicApiAgent(dataProvider, llmLendingTool);
    await agent.init();
  });

  this.afterAll(async () => {
    await agent.stop();
  });


  it("irrelevant messages do not interrupt the flow", async function () {
    llmLendingTool.log = async () => {};
    agent = new DynamicApiAgent(dataProvider, llmLendingTool);
    agent.log = async () => {};
    await agent.init();
    await agent.processUserInput("hi!");
    await agent.processUserInput("how are you?");
    await agent.processUserInput("I want to borrow some weth");
    await agent.processUserInput("what time is it now?");
    await agent.processUserInput("I want to borrow on base, the amount is 1.2");
    expect(agent.payload.tool).to.be.equal("borrow");
    expect(agent.payload.specifiedChainName).to.be.equal("Base");
    expect(agent.payload.specifiedTokenName).to.be.equal("WETH");
    expect(agent.payload.amount).to.be.equal("1.2");
    await agent.stop();
  });

  it("overriding a choice works", async function () {
    // llmLendingTool.log = async () => {};
    llmLendingTool = new LLMLendingToolOpenAI();
    agent = new DynamicApiAgent(dataProvider, llmLendingTool);
    // agent.log = async () => {};
    await agent.processUserInput("I want to borrow some weth");
    await agent.processUserInput("I want to borrow on base");
    await agent.processUserInput("actually I want to borrow WBTC");
    await agent.processUserInput("actually I want to borrow it on Arbitrum");
    await agent.processUserInput("how are you?");
    expect(agent.payload.tool).to.be.equal("borrow");
    expect(agent.payload.specifiedChainName).to.be.equal("Arbitrum");
    expect(agent.payload.specifiedTokenName).to.be.equal("WBTC");
    expect(agent.payload.amount).to.be.null;
    await agent.stop();
  });

  describe("Order of input messages does not matter", function () {
    const message_parts = ["borrow", "use ethereum chain", "1.2 of weth"];
    permutations(message_parts).forEach((messages) => {
      it("step-by-step flow: " + messages.join(", "), async () => {
        llmLendingTool.log = async () => {};
        agent = new DynamicApiAgent(dataProvider, llmLendingTool);
        agent.log = async () => {};
        await agent.init();
        for (const message of messages) {
          await agent.processUserInput(message);
        }
        expect(agent.payload.tool).to.be.equal("borrow");
        expect(agent.payload.specifiedChainName).to.be.equal("Ethereum");
        expect(agent.payload.specifiedTokenName).to.be.equal("WETH");
        expect(agent.payload.amount).to.be.equal("1.2");
        await agent.stop();
      });
    });
  });
});
