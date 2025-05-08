import { ChatOpenAI } from "@langchain/openai";
import { createOpenAIToolsAgent, AgentExecutor } from "langchain/agents";
import { pull } from "langchain/hub";
import { StructuredTool } from "@langchain/core/tools";
import EmberClient, { OrderType, TransactionType } from "../src/index.js";
import { z } from "zod";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// Create tools for the Ember SDK operations
class GetChainsTool extends StructuredTool {
  name = "get_chains";
  description =
    "Get a list of supported blockchain chains. Returns information about available chains.";
  client: EmberClient;

  constructor(client: EmberClient) {
    super();
    this.client = client;
  }

  async _call() {
    const { chains } = await this.client.getChains({
      pageSize: 10,
      filter: "",
      pageToken: "",
    });
    return JSON.stringify(chains);
  }
}

class GetTokensTool extends StructuredTool {
  name = "get_tokens";
  description =
    "Get tokens available on a specific chain. Input should be a chain ID.";
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
      filter: "",
      pageToken: "",
    });
    return JSON.stringify(tokens);
  }
}

class SwapTokensTool extends StructuredTool {
  name = "swap_tokens";
  description = "Swap one token for another on a specific chain.";
  client: EmberClient;
  // The types of these are incomprehensible and not that important for safety
  /* eslint-disable @typescript-eslint/no-explicit-any */
  publicClient: any;
  walletClient: any;

  constructor(client: EmberClient, publicClient: any, walletClient: any) {
    super();
    this.client = client;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  schema = z.object({
    chainId: z.string().describe("The chain ID where the swap will occur"),
    baseTokenId: z.string().describe("The ID of the token you want to buy"),
    quoteTokenId: z.string().describe("The ID of the token you want to sell"),
    amount: z.string().describe("The amount to swap in the smallest unit"),
    recipient: z
      .string()
      .describe("The wallet address to receive the swapped tokens"),
  });

  async _call({
    chainId,
    baseTokenId,
    quoteTokenId,
    amount,
    recipient,
  }: {
    chainId: string;
    baseTokenId: string;
    quoteTokenId: string;
    amount: string;
    recipient: string;
  }) {
    const swap = await this.client.swapTokens({
      orderType: OrderType.MARKET_BUY,
      baseToken: {
        chainId,
        address: baseTokenId,
      },
      quoteToken: {
        chainId,
        address: quoteTokenId,
      },
      amount,
      recipient,
    });

    // Check if we have valid transactions
    if (!swap.transactions || swap.transactions.length === 0) {
      throw new Error("No transactions received");
    }

    // Get the main transaction (typically the last one after approvals)
    const transaction = swap.transactions[swap.transactions.length - 1];

    // Verify this is an EVM transaction
    if (transaction.type !== TransactionType.EVM_TX) {
      throw new Error("Expected EVM transaction");
    }

    // Get the latest gas estimate
    const gasEstimate = await this.publicClient.estimateGas({
      account: recipient,
      to: transaction.to as `0x${string}`,
      data: transaction.data as `0x${string}`,
      value: BigInt(transaction.value || "0"),
    });

    // Send the transaction
    const hash = await this.walletClient.sendTransaction({
      to: transaction.to as `0x${string}`,
      data: transaction.data as `0x${string}`,
      value: BigInt(transaction.value || "0"),
      gas: gasEstimate,
    });

    console.log("Transaction sent:", { hash });

    // Create a clickable transaction link using provider tracking info
    if (swap.providerTracking?.explorerUrl) {
      const txLink = `${swap.providerTracking.explorerUrl}${hash}`;
      console.log("View provider transaction status:", txLink);
    }

    // Wait for the transaction to be mined
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    console.log("Transaction confirmed:", {
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === "success" ? "success" : "failed",
    });

    // Integrate provider tracking: use the swap's requestId and transaction hash to track swap status
    const requestId = swap.providerTracking?.requestId;
    if (requestId) {
      const trackingStatus = await this.client.getProviderTrackingStatus({
        requestId,
        transactionId: hash,
      });
      console.log("Provider Tracking Status:", trackingStatus);
    } else {
      console.log("No requestId available for provider tracking.");
    }

    // Add provider tracking information and transaction details to the response
    const response = {
      ...swap,
      transaction: {
        hash,
        status: receipt.status === "success" ? "success" : "failed",
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      },
      providerInfo: swap.providerTracking
        ? {
            provider: swap.providerTracking.providerName,
            requestId: swap.providerTracking.requestId,
            explorerUrl: swap.providerTracking.explorerUrl,
          }
        : undefined,
    };

    return JSON.stringify(response);
  }
}

class GetProviderTrackingStatusTool extends StructuredTool {
  name = "get_provider_tracking_status";
  description =
    "Get the status of a token swap from the provider using the requestId (from the swap response) and transactionId (transaction hash after submitting to blockchain).";
  client: EmberClient;

  constructor(client: EmberClient) {
    super();
    this.client = client;
  }

  schema = z.object({
    requestId: z
      .string()
      .describe("The requestId received from the swap response"),
    transactionId: z
      .string()
      .describe(
        "The transaction hash received after submitting the transaction to the blockchain",
      ),
  });

  async _call({
    requestId,
    transactionId,
  }: {
    requestId: string;
    transactionId: string;
  }) {
    const trackingStatus = await this.client.getProviderTrackingStatus({
      requestId,
      transactionId,
    });
    return JSON.stringify(trackingStatus);
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  if (!process.env.EMBER_API_KEY) {
    throw new Error("EMBER_API_KEY environment variable is required");
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  // Initialize the Ember client
  const client = new EmberClient({
    endpoint: "grpc.api.emberai.xyz:50051",
    apiKey: process.env.EMBER_API_KEY,
  });

  // Initialize Ethereum clients
  const transport = http(process.env.RPC_URL || "https://eth.llamarpc.com");
  const publicClient = createPublicClient({
    chain: mainnet,
    transport,
  });

  // Create wallet from private key
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport,
  });

  try {
    // Create tools
    const tools = [
      new GetChainsTool(client),
      new GetTokensTool(client),
      new SwapTokensTool(client, publicClient, walletClient),
      new GetProviderTrackingStatusTool(client),
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
      input:
        "I want to swap 1 WETH worth of USDC on Ethereum. First find the chain and tokens, then execute the swap.",
    });

    console.log("Agent Response:", result.output);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.close();
  }
}

main();
