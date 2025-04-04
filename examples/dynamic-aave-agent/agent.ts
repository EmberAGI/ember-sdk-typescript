import util from "util";
import { OpenAI } from "openai";
import clone from "clone";
import {
  ChainName,
  handleChatMessage,
  LendingToolPayload,
  LendingToolDataProvider,
  LLMLendingTool,
  TokenName,
  ParameterOptions,
} from "../../onchain-actions/build/src/services/api/dynamic/aave.js";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessage,
} from "openai/resources";
import readline from "readline";

const provideParametersTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "provide_parameters",
    description:
      "Read some parameters for the action from the given user message.",
    parameters: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          description: "Action to perform. Optional.",
        },
        tokenName: {
          type: "string",
          description: "The token name to use. Optional.",
        },
        chainName: {
          type: "string",
          description: "The chain name to use. Optional.",
        },
        amount: {
          type: "string",
          description: "The amount of asset to use (human readable). Optional.",
        },
      },
      required: [],
    },
  },
};

export class LLMLendingToolOpenAI implements LLMLendingTool {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  public async log(...args: unknown[]) {
    console.log(
      args
        .map((arg) =>
          typeof arg === "string"
            ? arg
            : util.inspect(arg, { depth: null, colors: true }),
        )
        .join(", "),
    );
  }

  private async specifyValue<T>(
    prompt: string,
    functionName: string,
    paramName: string,
    variants: T[],
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
      tools: [
        {
          type: "function",
          function: {
            name: functionName,
            description: `Determine which ${paramName} the user wants to use.`,
            parameters: {
              type: "object",
              properties: {
                [paramName]: {
                  type: "string",
                  enum: variants,
                  description: `The ${paramName} the user wants to use.`,
                },
              },
              required: [paramName],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    // TODO: handle the case with 0 or many tool calls
    try {
      const message = response.choices[0].message;
      const args = JSON.parse(message.tool_calls[0].function.arguments);
      this.log(`[${functionName}]: response: ${args[paramName]}`);
      return args[paramName];
    } catch (_e) {
      return null;
    }
  }

  async specifyTokenName(
    tokenName: TokenName,
    variants: TokenName[],
  ): Promise<TokenName | null> {
    return this.specifyValue(
      "Determine which token is this: " + tokenName,
      "detect_token_name",
      "tokenName",
      variants,
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
      variants,
    );
  }
}

export class MockLendingToolDataProvider implements LendingToolDataProvider {
  constructor(public tokenNames: Record<TokenName, ChainName[]>) {}

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

export type LendingToolParameters = {
  tool: "borrow" | "repay";
  tokenName: string;
  chainName: string;
  amount: string;
};

export class DynamicApiAgent {
  public parameterOptions: ParameterOptions | null = null;
  public conversationHistory: ChatCompletionMessageParam[] = [];
  private initialized = false;
  private openai: OpenAI;
  private rl: readline.Interface;
  public payload: LendingToolPayload;
  public dispatch: (payload: LendingToolParameters) => Promise<void> =
    async () => {};

  constructor(
    private dataProvider: LendingToolDataProvider,
    private llmLendingTool: LLMLendingTool,
  ) {
    this.resetPayload();
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set!");
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  public async resetParameterOptions() {
    const { parameterOptions } = await handleChatMessage(
      this.dataProvider,
      this.llmLendingTool,
      this.payload,
    );
    this.parameterOptions = parameterOptions;
  }

  public resetPayload() {
    this.payload = {
      tool: null,
      providedTokenName: null,
      specifiedTokenName: null,
      providedChainName: null,
      specifiedChainName: null,
      amount: null,
    };
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

  public mkProvideParametersTool(): ChatCompletionTool {
    const tool = clone(provideParametersTool);
    const { chainOptions, tokenOptions, toolOptions } = this.parameterOptions;
    if (chainOptions !== null) {
      tool.function.parameters.properties.chainName.enum = chainOptions;
    }
    if (tokenOptions !== null) {
      tool.function.parameters.properties.tokenName.enum = tokenOptions;
    }
    if (toolOptions !== null) {
      tool.function.parameters.properties.tool.enum = toolOptions;
    }
    this.log("[mkProvideParametersTool]:", tool);
    return tool;
  }

  async processUserInput(
    userInput: string,
  ): Promise<ChatCompletionMessageParam> {
    if (!this.initialized) {
      await this.init();
    }

    this.log("[processUserInput]:", userInput);
    this.conversationHistory.push({ role: "user", content: userInput });

    const parsedParametersResponse: ChatCompletionMessage = await this.callTool(
      [
        {
          role: "system",
          content:
            "NEVER ask the user to provide the parameters. Only specify parameters that were provided. All of the parameters ARE optional!!!",
        },
        { role: "user", content: userInput },
      ],
      [this.mkProvideParametersTool()],
    );
    this.log("[parsedParametersResponse]", parsedParametersResponse);
    parsedParametersResponse.content = parsedParametersResponse.content || "";
    await this.handleParametersResponse(parsedParametersResponse);
    return parsedParametersResponse;
  }

  async handleParametersResponse(
    message: ChatCompletionMessage,
  ): Promise<ParameterOptions | null> {
    if (message.tool_calls?.length) {
      // merge parameters from multiple tool calls first, because we don't want to
      // roundtrip to the server more than once
      let args: SpecifyParametersCall = {};
      for (const tool_call of message.tool_calls.reverse()) {
        const argsString: string = tool_call.function.arguments;
        const parsedArgs = JSON.parse(
          argsString || "{}",
        ) as SpecifyParametersCall;
        args = { ...args, ...parsedArgs };
      }

      this.log("[handleParametersResponse] parsed arguments:", args);

      if (["borrow", "repay"].includes(args.tool)) {
        this.payload.tool = args.tool as "borrow" | "repay";
      }

      if (args.amount) {
        this.payload.amount = args.amount;
      }

      if (args.chainName) {
        if (this.payload.providedChainName != args.chainName) {
          this.payload.specifiedChainName = null;
        }
        this.payload.providedChainName = args.chainName;
      }

      if (args.tokenName) {
        if (this.payload.providedTokenName != args.tokenName) {
          this.payload.specifiedTokenName = null;
        }
        this.payload.providedTokenName = args.tokenName;
      }

      const { parameterOptions: newParameterOptions, payload: updatedPayload } =
        await handleChatMessage(
          this.dataProvider,
          this.llmLendingTool,
          this.payload,
        );

      this.log("message", message);
      this.log("newParameterOptions", newParameterOptions);
      this.log("updatedPayload", updatedPayload);
      this.payload = updatedPayload;

      const finalizedPayload = this.finalizePayload();
      if (finalizedPayload !== null) {
        this.log("dispatching:", finalizedPayload);
        await this.dispatch(finalizedPayload);
        this.resetPayload();
        await this.resetParameterOptions();
      } else {
        this.log("not dispatching yet");
      }

      if (newParameterOptions !== null) {
        this.parameterOptions = newParameterOptions;
      }

      return newParameterOptions;
    } else {
      this.log(
        "No useful input provided from the user: provide_parameters wasn't called by LLM",
      );
      return null;
    }
  }

  private finalizePayload(): LendingToolParameters | null {
    if (
      this.payload.amount !== null &&
      this.payload.specifiedChainName !== null &&
      this.payload.specifiedTokenName !== null &&
      this.payload.tool !== null
    ) {
      return {
        amount: this.payload.amount,
        chainName: this.payload.specifiedChainName,
        tokenName: this.payload.specifiedTokenName,
        tool: this.payload.tool,
      };
    } else {
      return null;
    }
  }

  async callTool(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
  ): Promise<ChatCompletionMessage> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
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

    this.resetPayload();
    await this.resetParameterOptions();
    this.initialized = true;
  }

  public async log(...args: unknown[]) {
    console.log(
      args
        .map((arg) =>
          typeof arg === "string"
            ? arg
            : util.inspect(arg, { depth: null, colors: true }),
        )
        .join(" "),
    );
  }
}
