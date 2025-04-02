import { OpenAI } from "openai";
import { ChainName, handleChatMessage, LendingToolPayload, LendingToolDataProvider, LLMLendingTool, TokenName } from '../../onchain-actions/build/src/services/api/dynamic/aave.js';
import { ChatCompletionCreateParams } from "openai/resources/index.mjs";
import readline from "readline";
import { match, P } from "ts-pattern";

export type ChatCompletionRequestMessage = {
  content: string;
  role: "user" | "system" | "assistant";
  function_call?: {
    name: string;
    arguments: string;
  };
};

export class LLMLendingToolOpenAI implements LLMLendingTool {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  public async log(...args: unknown[]) {
    console.log(...args);
  }

  private async specifyValue<T>(
    prompt: string,
    functionName: string,
    paramName: string,
    variants: T[]
  ): Promise<T | null> {
    this.log(`[${functionName}]: ${prompt}`);
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
    this.log(`[${functionName}]: response: ${args[paramName]}`);
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

export class MockLendingToolDataProvider implements LendingToolDataProvider {
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

export type SpecifyParametersCall = {
  tool?: string;
  tokenName?: string;
  chainName?: string;
  amount?: string;
};

export class DynamicApiAgent {
  private functions: ChatCompletionCreateParams.Function[] = [];
  public conversationHistory: ChatCompletionRequestMessage[] = [];
  private openai: OpenAI;
  private rl: readline.Interface;
  public payload: LendingToolPayload;

  constructor(
    private dataProvider: LendingToolDataProvider,
    private llmLendingTool: LLMLendingTool,
  ) {
    this.payload = {
      tool: null,
      providedTokenName: null,
      specifiedTokenName: null,
      providedChainName: null,
      specifiedChainName: null,
      amount: null,
    };

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
        name: "provide_parameters",
        description:
        "Parse some parameters for the action from the last user message. All of the parameters are optional. Never ask the user to provide these parameters. Only specify parameters that were provided in the last message",
        parameters: {
          type: "object",
          properties: {
            tool: {
              type: "string",
              description: "Action to perform",
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
    await this.handleResponse(response as ChatCompletionRequestMessage);
    return response as ChatCompletionRequestMessage;
  }

  async handleResponse(message: ChatCompletionRequestMessage) {
    if (message.function_call?.name === 'provide_parameters') {
      const argsString: string = message.function_call.arguments;

      const args = JSON.parse(argsString || "{}") as SpecifyParametersCall;
      console.log('[handleResponse] parsed arguments:', args);

      if (["borrow", "repay"].includes(args.tool)) {
        this.payload.tool = args.tool as "borrow" | "repay";
      }
      if (args.amount) {
        this.payload.amount = args.amount;
      }
      if (args.chainName) {
        this.payload.providedChainName = args.chainName;
      }
      if (args.tokenName) {
        this.payload.providedTokenName = args.tokenName;
      }

      // .with([{ tool: P.nullish }, { tool: P.nullish } ], ([args, payload]) => {
      //   // unhandled case: no tool specified
      // });

      const { parameterOptions, payload: updatedPayload } = await handleChatMessage(
        this.dataProvider,
        this.llmLendingTool,
        this.payload
      );

      this.log('message', message);
      this.log('parameterOptions', parameterOptions);
      this.log('updatedPayload', updatedPayload);
      this.payload = updatedPayload;
    } else {
      this.log("No useful input provided from the user: provide_parameters wasn't called by LLM");
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

  async init() {
    this.conversationHistory = [
      {
        role: "system",
        content: `You are an assistant that provides access to blockchain lending and borrowing functionalities via Ember SDK. Never respond in markdown, always use plain text. Never add links to your response. Do not suggest the user to ask questions. When an unknown error happens, do not try to guess the error reason.`,
      },
    ];
  }

  public async log(...args: unknown[]) {
    console.log(...args);
  }
}
