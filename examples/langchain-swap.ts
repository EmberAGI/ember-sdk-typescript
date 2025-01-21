import { ChatOpenAI } from "@langchain/openai";
import { createOpenAIToolsAgent, AgentExecutor } from "langchain/agents";
import { pull } from "langchain/hub";
import { StructuredTool } from "@langchain/core/tools";
import EmberClient, { OrderType } from '../src/index.js';
import { z } from "zod";

// Create tools for the Ember SDK operations
class GetChainsTool extends StructuredTool {
  name = "get_chains";
  description = "Get a list of supported blockchain chains. Returns information about available chains.";
  client: EmberClient;

  constructor(client: EmberClient) {
    super();
    this.client = client;
  }

  async _call() {
    const { chains } = await this.client.getChains({
      pageSize: 10,
      filter: '',
      pageToken: '',
    });
    return JSON.stringify(chains);
  }
}

class GetTokensTool extends StructuredTool {
  name = "get_tokens";
  description = "Get tokens available on a specific chain. Input should be a chain ID.";
  client: EmberClient;

  constructor(client: EmberClient) {
    super();
    this.client = client;
  }

  schema = z.object({
    chainId: z.string().describe("The ID of the chain to get tokens for"),
  });

  async _call({ chainId }: { chainId: string }) {
    const { tokens } = await this.client.getTokens({
      chainId,
      pageSize: 100,
      filter: '',
      pageToken: '',
    });
    return JSON.stringify(tokens);
  }
}

class SwapTokensTool extends StructuredTool {
  name = "swap_tokens";
  description = "Swap one token for another on a specific chain.";
  client: EmberClient;

  constructor(client: EmberClient) {
    super();
    this.client = client;
  }

  schema = z.object({
    chainId: z.string().describe("The chain ID where the swap will occur"),
    baseTokenId: z.string().describe("The ID of the token you want to buy"),
    quoteTokenId: z.string().describe("The ID of the token you want to sell"),
    amount: z.string().describe("The amount to swap in the smallest unit"),
    recipient: z.string().describe("The wallet address to receive the swapped tokens"),
  });

  async _call({ chainId, baseTokenId, quoteTokenId, amount, recipient }: {
    chainId: string;
    baseTokenId: string;
    quoteTokenId: string;
    amount: string;
    recipient: string;
  }) {
    const swap = await this.client.swapTokens({
      type: OrderType.MARKET_BUY,
      baseToken: {
        chainId,
        tokenId: baseTokenId,
      },
      quoteToken: {
        chainId,
        tokenId: quoteTokenId,
      },
      amount,
      recipient,
    });
    return JSON.stringify(swap);
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  if (!process.env.EMBER_API_KEY) {
    throw new Error("EMBER_API_KEY environment variable is required");
  }

  if (!process.env.WALLET_ADDRESS) {
    throw new Error("WALLET_ADDRESS environment variable is required");
  }

  // Initialize the Ember client
  const client = new EmberClient({
    endpoint: 'api.emberai.xyz:443',
    apiKey: process.env.EMBER_API_KEY,
  });

  try {
    // Create tools
    const tools = [
      new GetChainsTool(client),
      new GetTokensTool(client),
      new SwapTokensTool(client),
    ];

    // Create the LLM
    const llm = new ChatOpenAI({
      modelName: "gpt-4",
      temperature: 0,
    });

    // Get the agent executor
    const prompt = await pull("hwchase17/openai-tools-agent");
    const agent = await createOpenAIToolsAgent({
      llm,
      tools,
      prompt,
    });
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });

    // Example: Execute a swap through the agent
    const result = await agentExecutor.invoke({
      input: "I want to swap 1 WETH worth of USDC on Ethereum. First find the chain and tokens, then execute the swap.",
    });

    console.log("Agent Response:", result.output);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

main(); 