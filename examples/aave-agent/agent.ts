import readline from "readline";
import { ethers } from "ethers";
import { OpenAI } from "openai";
import { ChatCompletionCreateParams } from "openai/resources/index.mjs";

// Import types from Ember SDK
import {
  TransactionPlan,
  GetCapabilitiesResponse,
  Capability,
  CapabilityType,
  GetWalletPositionsResponse,
  WalletPosition,
} from "../../src/generated/onchain_actions.js";
import {
  EmberClient
} from "../../src/lib/types/client.js";

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
  // Store both lending and borrowing capabilities for each token
  private tokenMap: Record<
    string,
    {
      chainId: string;
      address: string;
    }
  > = {};
  private availableTokens: string[] = [];
  private functions: ChatCompletionCreateParams.Function[] = [];
  private conversationHistory: ChatCompletionRequestMessage[] = [];
  private openai: OpenAI;
  private rl: readline.Interface;

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
        content: `You are an assistant that provides access to blockchain lending and borrowing functionalities via Ember SDK. Never respond in markdown, always use plain text. Never add links to your response. Do not suggest the user to ask questions. When an unknown error happens, do not try to guess the error reason.`,
      },
    ];

    console.log(
      "Fetching lending and borrowing capabilities from Ember SDK...",
    );

    const lendingCapabilities = (await this.client.getCapabilities({
      type: CapabilityType.LENDING,
    })) as GetCapabilitiesResponse;

    // Process capabilities and build tokenMap
    const processCapability = (capability: Capability) => {
      if (capability.lendingCapability) {
        const token = capability.lendingCapability.underlyingToken!;
        if (!this.tokenMap[token.name]) {
          this.tokenMap[token.name] = {
            chainId: token.tokenUid!.chainId,
            address: token.tokenUid!.address,
          };
        }
      }
    };

    lendingCapabilities.capabilities.forEach(processCapability);

    this.availableTokens = Object.keys(this.tokenMap);
    console.log(
      "Available tokens for lending and borrowing:",
      this.availableTokens,
    );

    // Define functions for the ChatCompletion call.
    this.functions = [
      {
        name: "borrow",
        description:
          "Borrow a token using Ember SDK. Provide the token name (one of the available tokens) and a human-readable amount.",
        parameters: {
          type: "object",
          properties: {
            tokenName: {
              type: "string",
              enum: this.availableTokens,
              description: "The token name to borrow.",
            },
            amount: {
              type: "string",
              description: "The amount to borrow (human readable).",
            },
          },
          required: ["tokenName", "amount"],
        },
      },
      {
        name: "repay",
        description:
          "Repay a borrowed token using Ember SDK. Provide the token name and a human-readable amount to repay.",
        parameters: {
          type: "object",
          properties: {
            tokenName: {
              type: "string",
              enum: this.availableTokens,
              description: "The token name to repay.",
            },
            amount: {
              type: "string",
              description: "The amount to repay (human readable).",
            },
          },
          required: ["tokenName", "amount"],
        },
      },
      {
        name: "supply",
        description:
          "Supply (deposit) a token using Ember SDK. Provide the token name (one of the available tokens) and a human-readable amount to supply.",
        parameters: {
          type: "object",
          properties: {
            tokenName: {
              type: "string",
              enum: this.availableTokens,
              description: "The token name to supply.",
            },
            amount: {
              type: "string",
              description: "The amount to supply (human readable).",
            },
          },
          required: ["tokenName", "amount"],
        },
      },
      {
        name: "withdraw",
        description:
          "Withdraw a previously supplied token using Ember SDK. Provide the token name and a human-readable amount to withdraw.",
        parameters: {
          type: "object",
          properties: {
            tokenName: {
              type: "string",
              enum: this.availableTokens,
              description: "The token name to withdraw.",
            },
            amount: {
              type: "string",
              description: "The amount to withdraw (human readable).",
            },
          },
          required: ["tokenName", "amount"],
        },
      },
      {
        name: "getUserPositions",
        description:
          "Get a summary of current wallet positions (borrowing and lending) using Ember SDK.",
        parameters: { type: "object", properties: {} },
      },
    ];
  }

  async start() {
    await this.init();
    console.log("Agent started. Type your message below.");
    this.promptUser();
  }

  promptUser() {
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
          content: `${functionName} call error: ${e}`
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
    console.log('tool:', functionName, args);
    const withFollowUp = (content: string) => ({ content, followUp: true });
    const verbatim = (content: string) => ({ content, followUp: false });
    switch (functionName) {
      case "borrow":
        return withFollowUp(
          await this.toolBorrow(args as { tokenName: string; amount: string }),
        );
      case "repay":
        return withFollowUp(
          await this.toolRepay(args as { tokenName: string; amount: string }),
        );
      case "supply":
        return withFollowUp(
          await this.toolSupply(args as { tokenName: string; amount: string }),
        );
      case "withdraw":
        return withFollowUp(
          await this.toolWithdraw(
            args as { tokenName: string; amount: string },
          ),
        );
      case "getUserPositions":
        return verbatim(await this.toolGetUserPositions());
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
        const txHash = await this.signAndSendTransaction(
          transaction
        );
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

  async toolBorrow(params: {
    tokenName: string;
    amount: string;
  }): Promise<string> {
    const { tokenName, amount } = params;
    const tokenDetail = this.tokenMap[tokenName];
    if (!tokenDetail) throw new Error(`Token ${tokenName} not found.`);

    console.log(
      `Executing borrow: ${tokenName} (address: ${tokenDetail.address}), amount: ${amount}`,
    );
    return this.executeAction("borrow", async () => {
      const response = await this.client.borrowTokens({
        tokenUid: {
          chainId: tokenDetail.chainId,
          address: tokenDetail.address,
        },
        amount: amount,
        borrowerWalletAddress: this.userAddress,
      });
      if (response.error || !response.transactions)
        throw new Error(
          response.error?.message || "No transaction plan returned",
        );
      return response.transactions;
    });
  }

  async toolRepay(params: {
    tokenName: string;
    amount: string;
  }): Promise<string> {
    const { tokenName, amount } = params;
    const tokenDetail = this.tokenMap[tokenName];
    if (!tokenDetail) throw new Error(`Token ${tokenName} not found.`);

    console.log(
      `Executing repay: ${tokenName} (address: ${tokenDetail.address}), amount: ${amount}`,
    );
    return this.executeAction("repay", async () => {
      const response = await this.client.repayTokens({
        tokenUid: {
          chainId: tokenDetail.chainId,
          address: tokenDetail.address,
        },
        amount: amount,
        borrowerWalletAddress: this.userAddress,
      });
      if (response.error || !response.transactions)
        throw new Error(
          response.error?.message || "No transaction plan returned",
        );
      return response.transactions;
    });
  }

  async toolSupply(params: {
    tokenName: string;
    amount: string;
  }): Promise<string> {
    const { tokenName, amount } = params;
    const tokenDetail = this.tokenMap[tokenName];
    if (!tokenDetail) throw new Error(`Token ${tokenName} not found.`);

    console.log(
      `Executing supply: ${tokenName} (address: ${tokenDetail.address}), amount: ${amount}`,
    );
    return this.executeAction("supply", async () => {
      const response = await this.client.supplyTokens({
        tokenUid: {
          chainId: tokenDetail.chainId,
          address: tokenDetail.address,
        },
        amount: amount,
        supplierWalletAddress: this.userAddress,
      });
      if (response.error || !response.transactions)
        throw new Error(
          response.error?.message || "No transaction plan returned",
        );
      return response.transactions;
    });
  }

  async toolWithdraw(params: {
    tokenName: string;
    amount: string;
  }): Promise<string> {
    const { tokenName, amount } = params;
    const tokenDetail = this.tokenMap[tokenName];
    if (!tokenDetail) throw new Error(`Token ${tokenName} not found.`);

    console.log(
      `Executing withdraw: ${tokenName} (address: ${tokenDetail.address}), amount: ${amount}`,
    );
    return this.executeAction("withdraw", async () => {
      const response = await this.client.withdrawTokens({
        tokenUid: {
          chainId: tokenDetail.chainId,
          address: tokenDetail.address,
        },
        amount: amount,
        lenderWalletAddress: this.userAddress,
      });
      if (response.error || !response.transactions)
        throw new Error(
          response.error?.message || "No transaction plan returned",
        );
      return response.transactions;
    });
  }


  private describeWalletPosition(position: WalletPosition): string {
    if (position.lendingPosition) {
      let output = "User Positions:\n";
      output += `Total Liquidity (USD): ${formatNumeric(position.lendingPosition.totalLiquidityUsd)}\n`;
      output += `Total Collateral (USD): ${formatNumeric(position.lendingPosition.totalCollateralUsd)}\n`;
      output += `Total Borrows (USD): ${formatNumeric(position.lendingPosition.totalBorrowsUsd)}\n`;
      output += `Net Worth (USD): ${formatNumeric(position.lendingPosition.netWorthUsd)}\n`;
      output += `Health Factor: ${formatNumeric(position.lendingPosition.healthFactor)}\n\n`;
      output += "Deposits:\n";
      for (const entry of position.lendingPosition.userReserves) {
        if (parseFloat(entry.underlyingBalance) > 0) {
          const underlyingUSD = entry.underlyingBalanceUsd
            ? formatNumeric(entry.underlyingBalanceUsd)
            : "N/A";
          output += `- ${entry!.token!.symbol}: ${entry.underlyingBalance} (USD: ${underlyingUSD})\n`;
        }
      }
      output += "\nLoans:\n";
      for (const entry of position.lendingPosition.userReserves) {
        const borrow = entry.totalBorrows || "0";
        if (parseFloat(borrow) > 0) {
          const totalBorrows = entry.totalBorrows;
          const totalBorrowsUSD = entry.totalBorrowsUsd
            ? formatNumeric(entry.totalBorrowsUsd)
            : "N/A";
          output += `- ${entry.token!.symbol}: ${totalBorrows} (USD: ${totalBorrowsUSD})\n`;
        }
      }
      return output;
    }
    return '';
  }

  async toolGetUserPositions(): Promise<string> {
    try {
      let res = '';
      const positionsResponse = (await this.client.getWalletPositions({
        walletAddress: this.userAddress,
      })) as GetWalletPositionsResponse;
      for (const position of positionsResponse.positions) {
        res += this.describeWalletPosition(position) + "\n";
      }
      return res;
    } catch (error: unknown) {
      const err = error as Error;
      logError("Error in getUserPositions:", err);
      throw new Error(`Error in getUserPositions: ${err.message}`);
    }
  }

  async signAndSendTransaction(tx: TransactionPlan): Promise<string> {
    const provider = this.signer.provider;
    const ethersTx: ethers.PopulatedTransaction = {
      to: tx.to,
      value: ethers.BigNumber.from(tx.value),
      data: tx.data,
      from: this.userAddress,
    };
    await provider!.estimateGas(ethersTx);
    const txResponse = await this.signer.sendTransaction(
      ethersTx,
    );
    await txResponse.wait();
    return txResponse.hash;
  }
}

function formatNumeric(value: string): string {
  const num = parseFloat(value);
  if (Number.isInteger(num)) return num.toString();
  return parseFloat(num.toFixed(2)).toString();
}
