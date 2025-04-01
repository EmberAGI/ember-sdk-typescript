import { OpenAI } from "openai";
import * as dotenv from "dotenv";
import { ChainName, handleChatMessage, LendingToolPayload, LendingToolDataProvider, LLMLendingTool, TokenName } from '../../onchain-actions/build/src/services/api/dynamic/aave.js';
import { ChatCompletionCreateParams } from "openai/resources/index.mjs";
import readline from "readline";

dotenv.config();

type ChatCompletionRequestMessage = {
  content: string;
  role: "user" | "system" | "assistant";
  function_call?: {
    name: string;
    arguments: string;
  };
};

class LLMLendingToolOpenAI implements LLMLendingTool {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  private async specifyValue<T>(
    prompt: string,
    functionName: string,
    paramName: string,
    variants: T[]
  ): Promise<T | null> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      functions: [
        {
          name: functionName,
          description: `Determine which ${paramName} is used.`,
          parameters: {
            type: "object",
            properties: {
              [paramName]: {
                type: "string",
                enum: variants,
                description: `The ${paramName}.`,
              },
            },
            required: [paramName],
          },
        },
      ],
      function_call: "auto",
    });

    const message: ChatCompletionRequestMessage = response.choices[0].message as ChatCompletionRequestMessage;
    const args = JSON.parse(message.function_call!.arguments);
    return args[paramName];
  }

  async specifyTokenName(
    tokenName: TokenName,
    variants: TokenName[],
  ): Promise<TokenName | null> {
    return this.specifyValue(
      "Determine which token is this: " + tokenName,
      "detect_token_name",
      "tokenName",
      variants
    );
  }

  async specifyChainName(
    chainName: ChainName,
    variants: ChainName[],
  ): Promise<ChainName | null> {
    return this.specifyValue(
      "Determine which chain name is this: " + chainName,
      "detect_chain_name",
      "chainName",
      variants
    );
  }
}

class MockLendingToolDataProvider implements LendingToolDataProvider {
  constructor(
    private tokenNames: Record<TokenName, ChainName[]>
  ) {
  }

  async getAvailableTokenNames(): Promise<TokenName[]> {
    return [...Object.keys(this.tokenNames)];
  }

  async getAvailableChainNamesForToken(token: TokenName): Promise<ChainName[]> {
    return this.tokenNames[token];
  }
}

type SpecifyParametersCall = {
  action?: string;
  tokenName?: string;
  chainName?: string;
  amount?: string;
};

export class DynamicApiAgent {
  private functions: ChatCompletionCreateParams.Function[] = [];
  public conversationHistory: ChatCompletionRequestMessage[] = [];
  private openai: OpenAI;
  private rl: readline.Interface;
  private payload: LendingToolPayload;
  private dataProvider: LendingToolDataProvider;
  private llmLendingTool: LLMLendingTool;

  constructor() {
    this.payload = { tool: null };

    this.dataProvider = new MockLendingToolDataProvider({
      "WETH": ["Arbitrum", "Base", "Ethereum"],
      "WBTC": ["Arbitrum", "Ethereum"],
      "ARB": ["Arbitrum"],
    });

    this.llmLendingTool = new LLMLendingToolOpenAI();

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set!");
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.functions = [
      {
        name: "specify_parameters",
        description:
        "Specify some parameters for the action. All of them are optional. Never ask the user to provide these parameters.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["borrow", "repay"]
            },
            tokenName: {
              type: "string",
              description: "The token name to use.",
            },
            chainName: {
              type: "string",
              description: "The chain name to use.",
            },
            amount: {
              type: "string",
              description: "The amount of asset to use (human readable).",
            },
          },
          required: [],
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
    userInput: string,
  ): Promise<ChatCompletionRequestMessage> {
    this.conversationHistory.push({ role: "user", content: userInput });
    const response = await this.callChatCompletion();
    response.content = response.content || "";
    console.log('response', response);
    await this.handleResponse(response as ChatCompletionRequestMessage);
    return response as ChatCompletionRequestMessage;
  }

  async handleResponse(message: ChatCompletionRequestMessage | undefined) {
    if (!message) return;
    if (message.function_call) {
      const functionName = message.function_call.name;
      const argsString = message.function_call.arguments;
      if (functionName === 'specify_parameters') {
        const args = JSON.parse(argsString || "{}") as SpecifyParametersCall;
        console.log('parsed arguments', args);
        if (args.action) {
          this.payload.tool = args.action as "borrow" | "repay";
        }
        // TODO: the rest of the parameters
      }
    }
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

  async log(...args: unknown[]) {
    console.log(...args);
  }

  async init() {
    this.conversationHistory = [
      {
        role: "system",
        content: `You are an assistant that provides access to blockchain lending and borrowing functionalities via Ember SDK. Never respond in markdown, always use plain text. Never add links to your response. Do not suggest the user to ask questions. When an unknown error happens, do not try to guess the error reason.`,
      },
    ];
  }
}

async function main () {
  const agent = new DynamicApiAgent();
  await agent.start();
}

main();
