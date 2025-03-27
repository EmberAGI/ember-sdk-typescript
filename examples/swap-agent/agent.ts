import readline from "readline";
import { ethers } from "ethers";
import { OpenAI } from "openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import {
  EmberClient,
  OrderType,
  TransactionType,
  TransactionPlan
} from "@emberai/sdk-typescript";

function logError(...args: unknown[]) {
  console.error(...args);
}

type ChatCompletionRequestMessage = {
  content: string;
  role: "user" | "system" | "assistant";
  function_call?: {
    name: string;
    arguments: string;
  };
};

export class Agent {
  private client: EmberClient;
  private signer: ethers.Signer;
  private userAddress: string;
  private chainId: string;
  private availableTokens: Array<{ symbol: string; address: string }> = [];
  private functions: ChatCompletionCreateParams.Function[] = [];
  public conversationHistory: ChatCompletionRequestMessage[] = [];
  private openai: OpenAI;
  private rl: readline.Interface;

  constructor(
    client: EmberClient,
    signer: ethers.Signer,
    userAddress: string,
    chainId: string
  ) {
    this.client = client;
    this.signer = signer;
    this.userAddress = userAddress;
    this.chainId = chainId;
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

  async init() {
    this.conversationHistory = [
      {
        role: "system",
        content: `You are an assistant that helps users swap tokens using the Ember SDK. Users may provide commands like "swap <amount> tokenA to tokenB", "swap tokenA to <amount> tokenB", "buy tokenX", or "sell tokenY". Internally, interpret these commands using market order logic:

- If the amount is specified with the first token (e.g., "swap <amount> tokenA to tokenB" or "sell tokenA"), treat it as selling that amount of tokenA to receive tokenB (MARKET_SELL order type).
- If the amount is specified with the second token (e.g., "swap tokenA to <amount> tokenB" or "buy tokenB"), treat it as buying that amount of tokenB using tokenA (MARKET_BUY order type).
- For simple buy or sell commands without an amount or complete pair, prompt the user for the necessary details (such as amount and the token to swap with) before proceeding.

You can help users swap between tokens on the configured chain. Users can specify tokens by symbol (e.g., "ETH", "USDC") or by full address (e.g., "0x123..."). Never respond in markdown; always use plain text. Never include links in your responses. Do not prompt the user to ask questions. When an unknown error occurs, do not attempt to guess the error reason.`,
      },
    ];

    this.log(`Fetching available tokens on Chain ID ${this.chainId}...`);
    const { tokens } = await this.client.getTokens({
      chainId: this.chainId,
      filter: "",
    });

    this.availableTokens = tokens
      .filter((token) => token.tokenUid)
      .map((token) => ({
        symbol: token.symbol,
        address: token.tokenUid!.address,
      }));

    this.log("Available tokens:");
    // this.availableTokens.forEach((token) => {
    //   this.log(`  (symbol:${token.symbol}, chain-id:${this.chainId}, address:${token.address})`);
    // });

    this.functions = [
      {
        name: "swapTokens",
        description: "Swap tokens using Ember SDK. Provide the input token and output token (using either symbol or address), and amount to swap.",
        parameters: {
          type: "object",
          properties: {
            inputToken: {
              type: "string",
              description: "The token to swap from - can be either a token symbol (e.g., 'ETH') or token address (e.g., '0x1234...').",
            },
            outputToken: {
              type: "string",
              description: "The token to swap to - can be either a token symbol (e.g., 'USDC') or token address (e.g., '0x1234...').",
            },
            amount: {
              type: "string",
              description: "The amount to swap (in input token's smallest unit).",
            },
            orderType: {
              type: "string",
              description: "The order type to use for the swap. Can be 'MARKET_SELL' (sell exact amount of input token) or 'MARKET_BUY' (buy exact amount of output token).",
              enum: ["MARKET_SELL", "MARKET_BUY"],
              default: "MARKET_SELL"
            },
          },
          required: ["inputToken", "outputToken", "amount"],
        },
      },
      {
        name: "getTokenPrice",
        description: "Get the current price of a token pair.",
        parameters: {
          type: "object",
          properties: {
            inputToken: {
              type: "string",
              description: "The input token - can be either a token symbol (e.g., 'ETH') or token address (e.g., '0x1234...').",
            },
            outputToken: {
              type: "string",
              description: "The output token - can be either a token symbol (e.g., 'USDC') or token address (e.g., '0x1234...').",
            },
            orderType: {
              type: "string",
              description: "The order type to use for the price check. Can be 'MARKET_SELL' or 'MARKET_BUY'.",
              enum: ["MARKET_SELL", "MARKET_BUY"],
              default: "MARKET_SELL"
            },
          },
          required: ["inputToken", "outputToken"],
        },
      },
    ];
  }

  async start() {
    await this.init();
    this.log("Agent started. Type your message below.");
    this.promptUser();
  }

  async stop() {
    this.rl.close();
  }

  promptUser() {
    this.rl.question("[user]: ", async (input: string) => {
      await this.processUserInput(input);
      this.promptUser();
    });
  }

  async processUserInput(
    userInput: string
  ): Promise<ChatCompletionRequestMessage> {
    this.conversationHistory.push({ role: "user", content: userInput });
    const response = await this.callChatCompletion();
    response.content = response.content || "";
    await this.handleResponse(response as ChatCompletionRequestMessage);
    return response as ChatCompletionRequestMessage;
  }

  async callChatCompletion() {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: this.conversationHistory,
      functions: this.functions,
      function_call: "auto",
    });
    return response.choices[0].message;
  }

  async handleResponse(message: ChatCompletionRequestMessage | undefined) {
    if (!message) return;
    if (message.function_call) {
      const functionName = message.function_call.name;
      const argsString = message.function_call.arguments;
      let args;
      try {
        args = JSON.parse(argsString || "{}");
      } catch (error) {
        logError("Error parsing function arguments:", error);
        args = {};
      }
      try {
        const { content: result, followUp: shouldFollowUp } =
          await this.handleToolCall(functionName, args);
        this.conversationHistory.push({
          role: "assistant",
          content: "",
          function_call: message.function_call,
        });
        this.conversationHistory.push({ role: "assistant", content: result });
        if (shouldFollowUp) {
          const followUp = await this.callChatCompletion();
          if (followUp && followUp.content) {
            this.log("[assistant]:", followUp.content);
            this.conversationHistory.push({
              role: "assistant",
              content: followUp.content,
            });
          }
        } else {
          this.log("[assistant]:", result);
        }
      } catch (e) {
        this.conversationHistory.push({
          role: "assistant",
          content: `${functionName} call error: ${e}`,
        });
        logError("handleResponse", e);
      }
    } else {
      this.log("[assistant]:", message.content);
      this.conversationHistory.push({
        role: "assistant",
        content: message.content || "",
      });
    }
  }

  async handleToolCall(
    functionName: string,
    args: Record<string, unknown>
  ): Promise<{ content: string; followUp: boolean }> {
    this.log("tool:", functionName, args);
    const withFollowUp = (content: string) => ({ content, followUp: true });
    const verbatim = (content: string) => ({ content, followUp: false });

    switch (functionName) {
      case "swapTokens":
        return withFollowUp(
          await this.toolSwapTokens(args as {
            inputToken: string;
            outputToken: string;
            amount: string;
            orderType?: string;
          })
        );
      case "getTokenPrice":
        return verbatim(
          await this.toolGetTokenPrice(args as {
            inputToken: string;
            outputToken: string;
            orderType?: string;
          })
        );
      default:
        return withFollowUp(`Unknown function: ${functionName}`);
    }
  }

  async executeAction(
    actionName: string,
    actionFunction: () => Promise<{ transactions: TransactionPlan[] }>
  ): Promise<string> {
    try {
      const result = await actionFunction();
      if (!result.transactions || result.transactions.length === 0) {
        throw new Error("No transaction plan received");
      }

      for (const transaction of result.transactions) {
        const txHash = await this.signAndSendTransaction(transaction);
        this.log("transaction sent:", txHash);
      }
      return `${actionName}: success!`;
    } catch (error: unknown) {
      const err = error as Error;
      const reason = err.message;
      logError(`Error in ${actionName}:`, reason);
      return `Error executing ${actionName}: ${reason}`;
    }
  }

  async executePriceQuery<T>(
    actionName: string,
    actionFunction: () => Promise<T>,
    formatResult: (result: T) => string
  ): Promise<string> {
    try {
      const result = await actionFunction();
      return formatResult(result);
    } catch (error: unknown) {
      const err = error as Error;
      const reason = err.message;
      logError(`Error in ${actionName}:`, reason);
      return `Error executing ${actionName}: ${reason}`;
    }
  }

  async signAndSendTransaction(transaction: TransactionPlan): Promise<string> {
    if (transaction.type !== TransactionType.EVM_TX) {
      throw new Error("Expected EVM transaction");
    }

    const provider = this.signer.provider;
    const gasEstimate = await provider!.estimateGas({
      from: this.userAddress,
      to: transaction.to,
      data: transaction.data,
      value: transaction.value || "0",
    });

    const txResponse = await this.signer.sendTransaction({
      to: transaction.to,
      data: transaction.data,
      value: transaction.value || "0",
      gasLimit: gasEstimate,
    });

    await txResponse.wait();
    return txResponse.hash;
  }

  /**
   * Helper method to find a token by either symbol or address
   */
  private resolveToken(tokenInput: string): { symbol: string; address: string } | undefined {
    return this.availableTokens.find(
      t => t.symbol.toLowerCase() === tokenInput.toLowerCase() || 
           t.address.toLowerCase() === tokenInput.toLowerCase()
    );
  }

  /**
   * Helper method to check if the input is an address
   */
  private isAddress(input: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(input);
  }

  async toolSwapTokens(params: {
    inputToken: string;
    outputToken: string;
    amount: string;
    orderType?: string;
  }): Promise<string> {
    const { inputToken, outputToken, amount, orderType = "MARKET_SELL" } = params;
    
    let inputTokenInfo;
    let outputTokenInfo;
    
    // Handle input token
    if (this.isAddress(inputToken)) {
      // If it's an address, use it directly
      inputTokenInfo = {
        symbol: "TOKEN", // Generic placeholder for address-only tokens
        address: inputToken
      };
    } else {
      // Otherwise try to resolve the symbol
      inputTokenInfo = this.resolveToken(inputToken);
      if (!inputTokenInfo) {
        throw new Error(`Invalid input token: ${inputToken}. Please provide a valid token symbol or address.`);
      }
    }
    
    // Handle output token
    if (this.isAddress(outputToken)) {
      // If it's an address, use it directly
      outputTokenInfo = {
        symbol: "TOKEN", // Generic placeholder for address-only tokens
        address: outputToken
      };
    } else {
      // Otherwise try to resolve the symbol
      outputTokenInfo = this.resolveToken(outputToken);
      if (!outputTokenInfo) {
        throw new Error(`Invalid output token: ${outputToken}. Please provide a valid token symbol or address.`);
      }
    }
    
    const inputTokenAddress = inputTokenInfo.address;
    const outputTokenAddress = outputTokenInfo.address;

    // Validate and parse order type
    let orderTypeEnum = OrderType.MARKET_SELL;
    if (orderType === "MARKET_BUY") {
      orderTypeEnum = OrderType.MARKET_BUY;
    }

    this.log(
      `Executing swap: ${amount} ${inputTokenInfo.symbol} to ${outputTokenInfo.symbol} (${orderType})`
    );

    return this.executeAction("swap", async () => {
      return await this.client.swapTokens({
        orderType: orderTypeEnum,
        baseToken: {
          chainId: this.chainId,
          address: inputTokenAddress,
        },
        quoteToken: {
          chainId: this.chainId,
          address: outputTokenAddress,
        },
        amount: amount,
        recipient: this.userAddress,
      });
    });
  }

  async toolGetTokenPrice(params: {
    inputToken: string;
    outputToken: string;
    orderType?: string;
  }): Promise<string> {
    const { inputToken, outputToken, orderType = "MARKET_SELL" } = params;
    
    let inputTokenInfo;
    let outputTokenInfo;
    
    // Handle input token
    if (this.isAddress(inputToken)) {
      // If it's an address, use it directly
      inputTokenInfo = {
        symbol: "TOKEN", // Generic placeholder for address-only tokens
        address: inputToken
      };
    } else {
      // Otherwise try to resolve the symbol
      inputTokenInfo = this.resolveToken(inputToken);
      if (!inputTokenInfo) {
        throw new Error(`Invalid input token: ${inputToken}. Please provide a valid token symbol or address.`);
      }
    }
    
    // Handle output token
    if (this.isAddress(outputToken)) {
      // If it's an address, use it directly
      outputTokenInfo = {
        symbol: "TOKEN", // Generic placeholder for address-only tokens
        address: outputToken
      };
    } else {
      // Otherwise try to resolve the symbol
      outputTokenInfo = this.resolveToken(outputToken);
      if (!outputTokenInfo) {
        throw new Error(`Invalid output token: ${outputToken}. Please provide a valid token symbol or address.`);
      }
    }
    
    const inputTokenAddress = inputTokenInfo.address;
    const outputTokenAddress = outputTokenInfo.address;

    // Validate and parse order type
    let orderTypeEnum = OrderType.MARKET_SELL;
    if (orderType === "MARKET_BUY") {
      orderTypeEnum = OrderType.MARKET_BUY;
    }

    return this.executePriceQuery(
      "get price",
      async () => {
        return await this.client.swapTokens({
          orderType: orderTypeEnum,
          baseToken: {
            chainId: this.chainId,
            address: inputTokenAddress,
          },
          quoteToken: {
            chainId: this.chainId,
            address: outputTokenAddress,
          },
          amount: "1000000000000000000", // 1 token in wei
          recipient: this.userAddress,
        });
      },
      (result) => {
        if (!result.estimation) {
          throw new Error("No price estimation available");
        }
        return `Current price: 1 ${inputTokenInfo.symbol} = ${result.estimation.quoteTokenDelta} ${outputTokenInfo.symbol}`;
      }
    );
  }
} 