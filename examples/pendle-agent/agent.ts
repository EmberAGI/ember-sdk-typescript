import readline from "readline";
import { ethers } from "ethers";
import { OpenAI } from "openai";
import { ChatCompletionCreateParams } from "openai/resources";
import { MultiChainSigner } from "../../test/multichain-signer.js";

// Import types from Ember SDK
import {
  EmberClient,
  TransactionPlan,
  PendleMarket,
  TokenIdentifier,
  SwapTokensRequest,
  OrderType,
} from "@emberai/sdk-typescript";

const GAS_LIMIT_BUFFER = 10; // percentage
const FEE_BUFFER = 5; // percentage, applies to maxFeePerGas and maxPriorityFeePerGas

function logError(...args: unknown[]) {
  console.error(...args);
}

type ChatCompletionRequestMessage = {
  content: string;
  role: "user" | "system" | "assistant" | "function";
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
};

enum TokenType {
  PT = "PT",  // Principal Token
  YT = "YT",  // Yield Token
}

export class Agent {
  private client: EmberClient;
  private signer: MultiChainSigner;
  private markets: PendleMarket[] = [];
  private marketMap: Record<string, PendleMarket> = {};
  private functions: ChatCompletionCreateParams.Function[] = [];
  public conversationHistory: ChatCompletionRequestMessage[] = [];
  private openai: OpenAI;
  private rl: readline.Interface;

  constructor(client: EmberClient, signer: MultiChainSigner) {
    this.client = client;
    this.signer = signer;
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set!");
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async log(...args: unknown[]) {
    console.log(...args);
  }

  async logError(...args: unknown[]) {
    console.error(...args);
  }

  async init() {
    // Set system instruction
    this.conversationHistory = [
      {
        role: "system",
        content: `You are an assistant that provides access to Pendle Finance via Ember SDK. 
You can help users interact with Pendle markets, which separate yield-bearing tokens into Principal Tokens (PT) and Yield Tokens (YT).

You can:
- List available Pendle markets
- Swap tokens to acquire PT or YT tokens
- Explain how Pendle markets work

Rules:
- Never respond in markdown, always use plain text
- Never add links to your response
- Do not suggest the user to ask questions
- When an unknown error happens, do not try to guess the error reason
- When an action has successfully finished, just respond with "Done!"`,
      },
    ];

    this.log("Fetching Pendle markets from Ember SDK...");

    try {
      // Get the list of Pendle markets
      const pendleResponse = await this.client.getPendleMarkets({
        chainIds: [], // Empty to get all supported chains
      });

      this.markets = pendleResponse.markets;
      
      // Build a map for quick access
      this.markets.forEach(market => {
        this.marketMap[market.name] = market;
      });

      this.log(`Loaded ${this.markets.length} Pendle markets`);
      
      const marketNames = this.markets.map(m => m.name);
      
      // Define functions for the ChatCompletion call
      this.functions = [
        {
          name: "listPendleMarkets",
          description: "List all available Pendle markets with their details",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "swapToPendleToken",
          description: "Swap tokens to get Pendle PT (Principal Token) or YT (Yield Token)",
          parameters: {
            type: "object",
            properties: {
              marketName: {
                type: "string",
                enum: marketNames,
                description: "The name of the Pendle market to interact with",
              },
              tokenType: {
                type: "string",
                enum: [TokenType.PT, TokenType.YT],
                description: "The type of token to acquire (PT or YT)",
              },
              inputAmount: {
                type: "string",
                description: "The amount of input token to swap (human readable)",
              },
            },
            required: ["marketName", "tokenType", "inputAmount"],
          },
        },
        {
          name: "explainPendleMarket",
          description: "Get detailed explanation about a specific Pendle market",
          parameters: {
            type: "object",
            properties: {
              marketName: {
                type: "string",
                enum: marketNames,
                description: "The name of the Pendle market to explain",
              },
            },
            required: ["marketName"],
          },
        }
      ];
    } catch (error) {
      this.logError("Error fetching Pendle markets:", error);
      throw error;
    }
  }

  async start() {
    try {
      await this.init();
      this.log("Agent started. Type your message below.");
      this.promptUser();
    } catch (error) {
      this.logError("Failed to start agent:", error);
    }
  }

  async stop() {
    this.rl.close();
  }

  promptUser() {
    this.rl.question("[user]: ", async (input: string) => {
      try {
        await this.processUserInput(input);
        this.promptUser();
      } catch (error) {
        this.logError("Error processing input:", error);
        this.promptUser();
      }
    });
  }

  async processUserInput(
    userInput: string,
  ): Promise<ChatCompletionRequestMessage> {
    this.conversationHistory.push({ role: "user", content: userInput });
    const response = await this.callChatCompletion();
    response.content = response.content || "";
    const followUp = await this.handleResponse(
      response as ChatCompletionRequestMessage,
    );
    if (typeof followUp !== "undefined") {
      return followUp as ChatCompletionRequestMessage;
    }
    return response as ChatCompletionRequestMessage;
  }

  async callChatCompletion() {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: this.conversationHistory as any[],
        functions: this.functions,
        temperature: 0.2,
      });
      return response.choices[0].message;
    } catch (error) {
      this.logError("Error calling OpenAI:", error);
      throw error;
    }
  }

  async handleResponse(message: ChatCompletionRequestMessage | undefined) {
    if (!message) {
      this.log("No response from AI");
      return;
    }

    // If the response has a function call
    if (message.function_call) {
      const functionName = message.function_call.name;
      let args;
      try {
        args = JSON.parse(message.function_call.arguments);
      } catch (e) {
        this.logError(
          `Failed to parse function arguments: ${message.function_call.arguments}`,
          e,
        );
        return;
      }

      // Execute the function
      try {
        const { content, followUp } = await this.handleToolCall(
          functionName,
          args,
        );
        this.conversationHistory.push({
          role: "assistant",
          content: message.content,
          function_call: message.function_call,
        });
        this.conversationHistory.push({
          role: "function",
          name: functionName,
          content,
        });
        this.log("[assistant]: " + content);
        
        if (followUp) {
          const followUpResponse = await this.callChatCompletion();
          followUpResponse.content = followUpResponse.content || "";
          this.conversationHistory.push({
            role: "assistant",
            content: followUpResponse.content,
          });
          this.log("[assistant]: " + followUpResponse.content);
        }
      } catch (e) {
        this.logError(`Error executing function ${functionName}:`, e);
        this.conversationHistory.push({
          role: "function",
          name: functionName,
          content: `Error: ${e instanceof Error ? e.message : String(e)}`,
        });
        this.log(`[assistant]: Error: ${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }

    // Plain text response
    this.conversationHistory.push({
      role: "assistant",
      content: message.content,
    });
    this.log("[assistant]: " + message.content);
  }

  async handleToolCall(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: string; followUp: boolean }> {
    this.log(`Executing function ${functionName} with args:`, args);
    
    const withFollowUp = (content: string) => ({ content, followUp: true });
    const verbatim = (content: string) => ({ content, followUp: false });

    switch (functionName) {
      case "listPendleMarkets":
        return verbatim(await this.toolListPendleMarkets());
      case "swapToPendleToken":
        return withFollowUp(
          await this.toolSwapToPendleToken({
            marketName: args.marketName as string,
            tokenType: args.tokenType as TokenType,
            inputAmount: args.inputAmount as string,
          }),
        );
      case "explainPendleMarket":
        return verbatim(
          await this.toolExplainPendleMarket({
            marketName: args.marketName as string,
          }),
        );
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  async executeAction(
    actionName: string,
    actionFunction: () => Promise<{
      transactions: TransactionPlan[];
      chainId: string;
    }>,
  ): Promise<string> {
    try {
      const { transactions, chainId } = await actionFunction();

      if (transactions.length === 0) {
        return "No transactions to execute.";
      }

      // Execute all transactions in sequence
      for (const tx of transactions) {
        const txHash = await this.signAndSendTransaction(tx, chainId);
        this.log(`Transaction submitted: ${txHash}`);
      }

      return "Done!";
    } catch (error) {
      console.error(`Error executing ${actionName}:`, error);
      return `Error executing ${actionName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async toolListPendleMarkets(): Promise<string> {
    if (this.markets.length === 0) {
      return "No Pendle markets available.";
    }

    const marketInfo = this.markets.map(market => {
      
      return `- ${market.name} (Chain: ${market.chainId})
  Underlying Asset: ${market.underlyingAsset?.symbol || 'Unknown'}
  Expiry: ${market.expiry}`;
    }).join('\n\n');

    return `Available Pendle markets:\n\n${marketInfo}`;
  }

  async toolExplainPendleMarket({
    marketName,
  }: {
    marketName: string;
  }): Promise<string> {
    const market = this.marketMap[marketName];
    if (!market) {
      return `Market "${marketName}" not found.`;
    }
    
    return `
Market: ${market.name} (on Chain ID: ${market.chainId})

Pendle markets separate yield-bearing tokens into two components:

1. Principal Tokens (PT): Represent the right to receive the underlying asset at market expiry.
   - Address: ${market.pt}

2. Yield Tokens (YT): Represent the right to receive yield earned by the underlying asset until expiry.
   - Address: ${market.yt}

Underlying Asset: ${market.underlyingAsset?.symbol || 'Unknown'} (${market.underlyingAsset?.name || 'Unknown'})
Expiry Date: ${market.expiry}

The Standardized Yield (SY) token is the yield-bearing token that Pendle uses internally.
SY Address: ${market.sy}

Market Contract Address: ${market.address}

Users can trade PT and YT separately, allowing for various fixed-income and yield-focused strategies.`;
  }

  async toolSwapToPendleToken({
    marketName,
    tokenType,
    inputAmount,
  }: {
    marketName: string;
    tokenType: TokenType;
    inputAmount: string;
  }): Promise<string> {
    const market = this.marketMap[marketName];
    if (!market) {
      return `Market "${marketName}" not found.`;
    }

    const userAddress = await this.signer.getAddress();
    
    // Determine which token to swap to
    const targetTokenAddress = tokenType === TokenType.PT ? market.pt : market.yt;
    
    try {
      return await this.executeAction("Swap to Pendle Token", async () => {
        // Create swap request
        const request: SwapTokensRequest = {
          orderType: OrderType.MARKET_BUY,
          baseToken: {
            chainId: market.chainId,
            address: targetTokenAddress, // The token we want to acquire
          },
          quoteToken: market.underlyingAsset?.tokenUid!, // The token we're providing
          amount: inputAmount,
          recipient: userAddress,
        };

        // Execute the swap
        const response = await this.client.swapTokens(request);
        
        if (response.error) {
          throw new Error(`Swap error: ${response.error.message}`);
        }
        
        if (!response.transactionPlan) {
          throw new Error("No transaction plan returned");
        }

        return {
          transactions: [response.transactionPlan],
          chainId: market.chainId,
        };
      });
    } catch (error) {
      this.logError("Error during swap:", error);
      return `Error swapping to ${tokenType}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async signAndSendTransaction(
    txPlan: TransactionPlan,
    chainIdStr: string,
  ): Promise<string> {
    // We can only process EVM transactions
    if (txPlan.type !== "EVM_TX") {
      throw new Error(`Unsupported transaction type: ${txPlan.type}`);
    }

    const chainId = parseInt(chainIdStr);
    const chainSigner = await this.signer.getSignerForChainId(chainId);

    // Prepare transaction data
    const txData = {
      to: txPlan.to,
      value: txPlan.value ? ethers.utils.parseEther(txPlan.value) : 0,
      data: txPlan.data,
    };

    let tx;
    try {
      // Get current gas settings
      const feeData = await chainSigner.provider!.getFeeData();
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 transaction
        tx = await chainSigner.sendTransaction({
          ...txData,
          maxFeePerGas: feeData.maxFeePerGas.mul(100 + FEE_BUFFER).div(100),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            .mul(100 + FEE_BUFFER)
            .div(100),
        });
      } else {
        // Legacy transaction
        tx = await chainSigner.sendTransaction({
          ...txData,
          gasPrice: feeData.gasPrice?.mul(100 + FEE_BUFFER).div(100),
        });
      }

      this.log(`Transaction sent with hash: ${tx.hash}`);
      const receipt = await tx.wait();
      this.log(`Transaction confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      this.logError("Transaction failed:", error);
      throw error;
    }
  }
}

// Helper function to format numeric values
function formatNumeric(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "Invalid number";
  
  // Format based on size
  if (Math.abs(num) < 0.01) {
    return num.toExponential(4);
  } else {
    return num.toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
  }
} 