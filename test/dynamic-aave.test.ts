import { expect } from "chai";
import dotenv from "dotenv";
import { LendingToolDataProvider } from "../onchain-actions/build/src/services/api/dynamic/aave.js";
import { LLMLendingToolOpenAI } from "../examples/dynamic-aave-agent/llm-lending-tool.ts";
import { DynamicApiAAVEAgent } from "../examples/dynamic-aave-agent/agent";
import { MockLendingToolDataProvider } from "../examples/dynamic-aave-agent/data-provider.ts";
import permutations from "./helpers/permutations";

dotenv.config();

describe("AAVE Dynamic API agent", function () {
  this.timeout(40_000);

  let agent: DynamicApiAAVEAgent;
  let dataProvider: LendingToolDataProvider;
  let llmLendingTool: LLMLendingToolOpenAI;

  this.beforeAll(async () => {
    dataProvider = new MockLendingToolDataProvider({
      WETH: ["Arbitrum", "Base", "Ethereum"],
      WBTC: ["Arbitrum", "Ethereum"],
      ARB: ["Arbitrum"],
    });

    llmLendingTool = new LLMLendingToolOpenAI();

    agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
    await agent.init();
  });

  this.afterAll(async () => {
    await agent.stop();
  });

  describe("LLMLendingTool", async function () {
    describe("specifyValue", async function () {
      // skipping because it's covered by other tests anyway
      // still useful to have this test here when tuning the prompt
      it.skip("is case-insensitive", async () => {
        llmLendingTool = new LLMLendingToolOpenAI();
        const res = await llmLendingTool.specifyChainName("ethereum", [
          "Ethereum",
          "Base",
          "Optimism",
          "Solana",
        ]);
        expect(res).to.be.equal("Ethereum");
      });
    });
  });

  it("irrelevant messages do not interrupt the flow", async function () {
    llmLendingTool = new LLMLendingToolOpenAI();
    agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
    let hasDispatched = false;
    agent.dispatch = async (payload) => {
      hasDispatched = true;
      expect(payload.tool).to.be.equal("borrow");
      expect(payload.chainName).to.be.equal("Base");
      expect(payload.tokenName).to.be.equal("WETH");
      expect(payload.amount).to.be.equal("1.2");
    };
    await agent.processUserInput("hi!");
    await agent.processUserInput("how are you?");
    await agent.processUserInput("I want to borrow some weth");
    await agent.processUserInput("what time is it now?");
    await agent.processUserInput("I want to borrow on base, the amount is 1.2");
    expect(hasDispatched).to.be.true;
    await agent.stop();
  });

  describe("mkProvideParametersTool (agent internal)", async function () {
    it("Can handle incorrect input properly", async function () {
      dataProvider = new MockLendingToolDataProvider({
        WETH: ["Arbitrum", "Base", "Ethereum"],
        WBTC: ["Arbitrum", "Ethereum"],
        ARB: ["Arbitrum"],
      });
      agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
      agent.parameterOptions!.chainOptions = ["Arbitrum"];
      const response = await agent.provideParameters("Base chain");
      expect(
        JSON.parse(response.tool_calls![0].function.arguments),
      ).to.be.deep.equal({
        chainName: null,
      });
    });
  });

  describe("Conflicting parameters must not be dispatched", async function () {
    describe("single message workflow", function () {
      it("complete params", async function () {
        dataProvider = new MockLendingToolDataProvider({
          WETH: ["Arbitrum", "Base", "Ethereum"],
          WBTC: ["Arbitrum", "Ethereum"],
          ARB: ["Arbitrum"],
        });
        agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
        const response = await agent.processUserInput(
          "I want to borrow some ARB on base",
        );
        expect(agent.payload.specifiedChainName).to.be.null;
        expect(agent.payload.specifiedTokenName).to.be.equal("ARB");
        expect(agent.payload.amount).to.be.null;
        expect(response.content).to.include.oneOf([
          "impossible",
          "not possible",
          "sorry",
          "apologize",
          "do not support",
          "not supported",
        ]);
        await agent.stop();
      });

      it("incomplete params", async function () {
        dataProvider = new MockLendingToolDataProvider({
          WETH: ["Arbitrum", "Base", "Ethereum"],
          WBTC: ["Arbitrum", "Ethereum"],
          ARB: ["Arbitrum"],
        });
        agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
        let hasDispatched = false;
        agent.dispatch = async () => {
          hasDispatched = true;
        };
        const response = await agent.processUserInput("borrow 1 ARB on base");
        expect(agent.payload.specifiedChainName).to.be.null;
        expect(agent.payload.specifiedTokenName).to.be.equal("ARB");
        expect(agent.payload.amount).to.be.equal("1");
        expect(response.content).to.include.oneOf([
          "impossible",
          "not possible",
          "sorry",
          "apologize",
          "do not support",
          "not supported",
        ]);
        expect(hasDispatched).to.be.false;
        await agent.stop();
      });
    });

    describe("two messages workflow", async function () {
      describe("complete, but conflicting params must be rejected", async function () {
        it("token first", async function () {
          dataProvider = new MockLendingToolDataProvider({
            WETH: ["Arbitrum", "Base", "Ethereum"],
            WBTC: ["Arbitrum", "Ethereum"],
            ARB: ["Arbitrum"],
          });
          agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
          let hasDispatched = false;
          agent.dispatch = async () => {
            hasDispatched = true;
          };
          const response = await agent.processUserInput("borrow 1 ARB");
          expect(response.content).to.not.include.oneOf(["base", "Base"]);
          await agent.processUserInput("on Base");
          expect(agent.payload.specifiedChainName).to.be.null;
          expect(agent.payload.specifiedTokenName).to.be.equal("ARB");
          expect(agent.payload.amount).to.be.equal("1");
          expect(hasDispatched).to.be.false;
          await agent.stop();
        });

        it("chain first", async function () {
          dataProvider = new MockLendingToolDataProvider({
            WETH: ["Arbitrum", "Base", "Ethereum"],
            WBTC: ["Arbitrum", "Ethereum"],
            ARB: ["Arbitrum"],
          });
          agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
          let hasDispatched = false;
          agent.dispatch = async () => {
            hasDispatched = true;
          };
          const response = await agent.processUserInput("borrow on Base");
          await agent.processUserInput("1 WBTC");
          expect(agent.payload.specifiedChainName).to.be.null;
          expect(agent.payload.specifiedTokenName).to.be.equal("WBTC");
          expect(agent.payload.amount).to.be.equal("1");
          expect(hasDispatched).to.be.false;
          await agent.stop();
        });
      });
    });
  });

  it("overriding a choice works", async function () {
    agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
    await agent.processUserInput("I want to borrow some weth");
    await agent.processUserInput("I want to borrow on base");
    await agent.processUserInput("actually I want to borrow WBTC");
    await agent.processUserInput("actually I want to borrow it on Arbitrum");
    await agent.processUserInput("actually I want to repay it, not borrow");
    expect(agent.payload.tool).to.be.equal("repay");
    expect(agent.payload.specifiedChainName).to.be.equal("Arbitrum");
    expect(agent.payload.specifiedTokenName).to.be.equal("WBTC");
    expect(agent.payload.amount).to.be.null;
    await agent.stop();
  });

  describe("options are visible to the user", () => {
    it("actions", async function () {
      llmLendingTool = new LLMLendingToolOpenAI();
      agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
      await agent.processUserInput("what can you do?");

      expect(agent.parameterOptions?.chainOptions).to.be.deep.equal(null);
      expect(agent.parameterOptions?.tokenOptions).to.be.deep.equal(null);
      expect(agent.parameterOptions?.toolOptions).to.be.deep.equal([
        "borrow",
        "repay",
      ]);
    });

    it("chains", async function () {
      agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
      await agent.processUserInput("I want to borrow some weth");

      expect(agent.parameterOptions?.chainOptions).to.be.deep.equal(
        await dataProvider.getAvailableChainNamesForToken("WETH"),
      );
      expect(agent.parameterOptions?.tokenOptions).to.be.deep.equal(null);
      expect(agent.parameterOptions?.toolOptions).to.be.deep.equal(null);
    });
  });

  it("sequence of multiple actions", async function () {
    agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);

    // action 1
    await agent.processUserInput("I want to borrow some weth");
    await agent.processUserInput("I want to borrow on base");
    await agent.processUserInput("actually I want to borrow WBTC");
    await agent.processUserInput("actually I want to borrow it on arbitrum");
    await agent.processUserInput("actually I want to repay it, not borrow");
    expect(agent.payload.tool).to.be.equal("repay");
    expect(agent.payload.specifiedChainName).to.be.equal("Arbitrum");
    expect(agent.payload.specifiedTokenName).to.be.equal("WBTC");
    expect(agent.payload.amount).to.be.null;
    let hasDispatched = false;
    agent.dispatch = async (payload) => {
      hasDispatched = true;
      expect(payload.tool).to.be.equal("repay");
      expect(payload.chainName).to.be.equal("Arbitrum");
      expect(payload.tokenName).to.be.equal("WBTC");
      expect(payload.amount).to.be.equal("1.2");
    };
    await agent.processUserInput("the amount should be 1.2");
    expect(hasDispatched).to.be.true;
    expect(agent.payload.tool).to.be.null;
    expect(agent.payload.providedChainName).to.be.null;
    expect(agent.payload.specifiedChainName).to.be.null;
    expect(agent.payload.providedTokenName).to.be.null;
    expect(agent.payload.specifiedTokenName).to.be.null;
    expect(agent.payload.amount).to.be.null;

    // action 2
    await agent.processUserInput("I want to borrow some weth");
    await agent.processUserInput("I want to borrow on base");
    await agent.processUserInput("actually I want to borrow WBTC");
    await agent.processUserInput("actually I want to borrow it on arbitrum");
    await agent.processUserInput("actually I want to repay it, not borrow");
    expect(agent.payload.tool).to.be.equal("repay");
    expect(agent.payload.specifiedChainName).to.be.equal("Arbitrum");
    expect(agent.payload.specifiedTokenName).to.be.equal("WBTC");
    expect(agent.payload.amount).to.be.null;
    hasDispatched = false;
    agent.dispatch = async (payload) => {
      hasDispatched = true;
      expect(payload.tool).to.be.equal("repay");
      expect(payload.chainName).to.be.equal("Arbitrum");
      expect(payload.tokenName).to.be.equal("WBTC");
      expect(payload.amount).to.be.equal("1.2");
    };
    await agent.processUserInput("the amount should be 1.2");
    expect(hasDispatched).to.be.true;
    expect(agent.payload.tool).to.be.null;
    expect(agent.payload.providedChainName).to.be.null;
    expect(agent.payload.specifiedChainName).to.be.null;
    expect(agent.payload.providedTokenName).to.be.null;
    expect(agent.payload.specifiedTokenName).to.be.null;
    expect(agent.payload.amount).to.be.null;

    await agent.stop();
  });

  describe("Order of input messages does not matter", function () {
    const message_parts = ["borrow", "use ethereum chain", "1.2 of weth"];
    permutations(message_parts).forEach((messages) => {
      it("step-by-step flow: " + messages.join(", "), async () => {
        agent = new DynamicApiAAVEAgent(dataProvider, llmLendingTool);
        let hasDispatched = false;
        agent.dispatch = async (payload) => {
          hasDispatched = true;
          expect(payload.tool).to.be.equal("borrow");
          expect(payload.chainName).to.be.equal("Ethereum");
          expect(payload.tokenName).to.be.equal("WETH");
          expect(payload.amount).to.be.equal("1.2");
        };
        for (const message of messages) {
          await agent.processUserInput(message);
        }
        expect(hasDispatched).to.be.true;
        await agent.stop();
      });
    });
  });
});
