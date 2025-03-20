import readline from "readline";
import { ethers } from "ethers";
import { OpenAI } from "openai";
import { ChatCompletionCreateParams } from "openai/resources/index.mjs";
import { EmberClient } from "@emberai/sdk-typescript";
import {
  LiquidityPosition,
  TokenIdentifier,
  TransactionPlan,
} from "@emberai/sdk-typescript";

const GAS_LIMIT_BUFFER = 20; // percentage
const FEE_BUFFER = 10; // percentage, applies to maxFeePerGas and maxPriorityFeePerGas

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

type LiquidityPair = {
  handle: string; // e.g. WETH/USDC
  token0: TokenIdentifier;
  token1: TokenIdentifier;
};

export class Agent {
  private client: EmberClient;
  private signer: ethers.Signer;
  private userAddress: string;
  private functions: ChatCompletionCreateParams.Function[] = [];
  private conversationHistory: ChatCompletionRequestMessage[] = [];
  private openai: OpenAI;
  private rl: readline.Interface;
  private pairs: LiquidityPair[] = [];
  private positions: LiquidityPosition[] = [];

  /**
   * @param client - an instance of EmberClient.
   * @param signer - an ethers.Signer that will sign transactions.
   * @param userAddress - the user's wallet address.
   */
  constructor(client: EmberClient, signer: ethers.Signer, userAddress: string) {
    this.client = client;
    this.signer = signer;
    this.userAddress = userAddress;
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set!");
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async init() {
    // Set system instruction with our updated Ember SDK context.
    this.conversationHistory = [
      {
        role: "system",
        content: `You are an assistant that provides access to blockchain liquidity management functions via Ember SDK.

You can:

- show user's liquidity positions
- supply liquidity
- close liquidity positions

Rules:

- never respond in markdown, always use plain text
- never add links to your response
- do not suggest the user to ask questions
- when an unknown error happens, do not try to guess the error reason.
- never print transaction hashes
- whenever an action has succesfully finished, just respond with "Done!", never repeat what the action was.
`,
      },
    ];

    const pools = (await this.client.getLiquidityPools()).liquidityPools;
    // TODO: check handles for uniqueness
    pools.forEach((pool) => {
      this.pairs.push({
        handle: pool.symbol0 + "/" + pool.symbol1,
        token0: pool.token0!,
        token1: pool.token1!,
      });
    });

    this.functions = [
      {
        name: "getUserLiquidityPositions",
        description:
          "List your liquidity positions with human-readable token amounts and price.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "getLiquidityPools",
        description: "List of available liquidity pools.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "supplyLiquidity",
        description:
          "Supply liquidity to a pair. Provide two token symbols and human-readable amounts along with price bounds.",
        parameters: {
          type: "object",
          properties: {
            pair: {
              type: "string",
              enum: this.pairs.map((pair) => pair.handle),
              description: "Liquidity pair",
            },
            amount0: {
              type: "string",
              description: "Amount for token A (human readable).",
            },
            amount1: {
              type: "string",
              description: "Amount for token B (human readable).",
            },
            priceFrom: {
              type: "string",
              description: "Lower bound price (human readable).",
            },
            priceTo: {
              type: "string",
              description: "Upper bound price (human readable).",
            },
          },
          required: ["pair", "amount0", "amount1", "priceFrom", "priceTo"],
        },
      },
      {
        name: "withdrawLiquidity",
        description:
          "Withdraw liquidity and close a position identified by number.",
        parameters: {
          type: "object",
          properties: {
            positionNumber: {
              type: "number",
              description: "The LP NFT position number to withdraw.",
            },
          },
          required: ["positionNumber"],
        },
      },
    ];
  }

  async start() {
    await this.init();
    console.log("Agent started. Type your message below.");
    this.promptUser();
  }

  private promptUser() {
    this.rl.question("[user]: ", async (input: string) => {
      await this.processUserInput(input);
      this.promptUser();
    });
  }

  async processUserInput(userInput: string) {
    this.conversationHistory.push({ role: "user", content: userInput });
    const response = await this.callChatCompletion();
    response.content = response.content || "";
    await this.handleResponse(response as ChatCompletionRequestMessage);
  }

  async callChatCompletion() {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
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
            console.log("[assistant]:", followUp.content);
            this.conversationHistory.push({
              role: "assistant",
              content: followUp.content,
            });
          }
        } else {
          console.log("[assistant]:", result);
        }
      } catch (e) {
        this.conversationHistory.push({
          role: "assistant",
          content: `${functionName} call error: ${e}`,
        });
        logError("handleResponse", e);
      }
    } else {
      console.log("[assistant]:", message.content);
      this.conversationHistory.push({
        role: "assistant",
        content: message.content || "",
      });
    }
  }

  async handleToolCall(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: string; followUp: boolean }> {
    console.log("tool:", functionName, args);
    const withFollowUp = (content: string) => ({ content, followUp: true });
    const verbatim = (content: string) => ({ content, followUp: false });
    switch (functionName) {
      case "supplyLiquidity":
        return withFollowUp(
          await this.toolSupplyLiquidity(
            args as {
              pair: string;
              amount0: string;
              amount1: string;
              priceFrom: string;
              priceTo: string;
              from: string;
            },
          ),
        );
      case "withdrawLiquidity":
        return withFollowUp(
          await this.toolWithdrawLiquidity(args as { positionNumber: number }),
        );
      case "getLiquidityPools":
        return verbatim(await this.toolGetLiquidityPools());
      case "getUserLiquidityPositions":
        return verbatim(await this.toolGetUserLiquidityPositions());
      default:
        return withFollowUp(`Unknown function: ${functionName}`);
    }
  }

  async executeAction(
    actionName: string,
    actionFunction: () => Promise<TransactionPlan[]>,
  ): Promise<string> {
    try {
      const transactions = await actionFunction();
      for (const transaction of transactions) {
        const txHash = await this.signAndSendTransaction(transaction);
        console.log("transaction sent:", txHash);
      }
      return `${actionName}: success!`;
    } catch (error: unknown) {
      const err = error as Error;
      const reason = err.message;
      logError(`Error in ${actionName}:`, reason);
      return `Error executing ${actionName}: ${reason}`;
    }
  }

  async toolWithdrawLiquidity(params: {
    positionNumber: number;
  }): Promise<string> {
    const { positionNumber } = params;
    if (!this.positions[positionNumber]) return "Position not found";
    const position = this.positions[positionNumber];
    return await this.executeAction("withdrawLiquidity", async () => {
      return (
        await this.client.withdrawLiquidity({
          tokenId: position.tokenId,
          providerId: position.providerId,
          supplierAddress: this.userAddress,
        })
      ).transactions;
    });
  }

  async toolGetLiquidityPools(): Promise<string> {
    const { liquidityPools } = await this.client.getLiquidityPools();
    if (liquidityPools.length == 0) {
      return "No liquidity pools available";
    }
    let res = "Liquidity pools:\n\n";
    for (const pool of liquidityPools) {
      res +=
        "- " +
        pool.symbol0 +
        "/" +
        pool.symbol1 +
        ", price: " +
        pool.price +
        "\n";
    }
    return res;
  }

  async toolGetUserLiquidityPositions(): Promise<string> {
    const { positions } = await this.client.getUserLiquidityPositions({
      supplierAddress: this.userAddress,
    });

    if (positions.length === 0) return "No liquidity positions found.";
    let output = "Your positions:\n\n";
    this.positions = positions;
    positions.forEach((pos, i) => {
      output += `${i} - ${pos.symbol0}/${pos.symbol1}
  ${pos.amount0} of ${pos.symbol0}
  ${pos.amount1} of ${pos.symbol1}
  price: ${pos.price}\n`;
    });
    return output;
  }

  async toolSupplyLiquidity(params: {
    pair: string;
    amount0: string;
    amount1: string;
    priceFrom: string;
    priceTo: string;
  }): Promise<string> {
    // can't fail, we can rely on structured llm output
    const identifiedPair: LiquidityPair = this.pairs.find(
      (pair) => pair.handle === params.pair,
    )!;
    const { token0, token1 } = identifiedPair;
    const { amount0, amount1, priceFrom, priceTo } = params;
    return await this.executeAction("supplyLiquidity", async () => {
      return (
        await this.client.supplyLiquidity({
          token0,
          token1,
          amount0,
          amount1,
          fullRange: false,
          limitedRange: {
            minPrice: priceFrom,
            maxPrice: priceTo,
          },
          supplierAddress: this.userAddress,
        })
      ).transactions;
    });
  }

  async signAndSendTransaction(apiTx: TransactionPlan): Promise<string> {
    const tx: ethers.PopulatedTransaction = {
      to: apiTx.to,
      value: ethers.BigNumber.from(apiTx.value),
      data: apiTx.data,
      from: this.userAddress,
    };
    const provider = this.signer.provider!;
    // bump gasLimit by GAS_LIMIT_BUFFER percent
    const gasEstimate = await provider.estimateGas(tx);
    tx.gasLimit = gasEstimate.mul(100 + GAS_LIMIT_BUFFER).div(100);
    // Apply FEE_BUFFER to fee data
    const feeData = await provider.getFeeData();
    tx.maxFeePerGas = feeData.maxFeePerGas!.mul(100 + FEE_BUFFER).div(100);
    tx.maxPriorityFeePerGas = feeData
      .maxPriorityFeePerGas!.mul(100 + FEE_BUFFER)
      .div(100);
    const txResponse = await this.signer.sendTransaction(tx);
    await txResponse.wait();
    return txResponse.hash;
  }
}
