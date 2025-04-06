import util from "util";
import { OpenAI } from "openai";
import clone from "clone";
import {
  handleChatMessage,
  LendingToolPayload,
  LendingToolDataProvider,
  LLMLendingTool,
  ParameterOptions,
} from "../../onchain-actions/build/src/services/api/dynamic/aave.js";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessage,
  ChatCompletionToolChoiceOption,
} from "openai/resources";
import readline from "readline";

export type SpecifyParametersCall = {
  tool?: string;
  tokenName?: string;
  chainName?: string;
  amount?: string;
};

// Must be in sync with SpecifyParametersCall
const provideParametersTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "provide_parameters",
    description: "Read some parameters from the given user message.",
    parameters: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          description:
            "Action to perform, like 'borrow' or 'repay'. Single identifier. Optional.",
          enum: ["borrow", "repay"],
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

// Must correspond to the real tool schema
export type LendingToolParameters = {
  tool: "borrow" | "repay";
  tokenName: string;
  chainName: string;
  amount: string;
};

export class DynamicApiAAVEAgent {
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
      const response = await this.processUserInput(input);
      console.log("[assistant]:", response.content);
      this.promptUser();
    });
  }

  // Create a tool that is not callable, but cointains some context for the LLM to
  // figure out how to ask the user for more input.
  public mkAskForParametersTool(): ChatCompletionTool {
    const tool = clone(provideParametersTool);
    const { chainOptions, tokenOptions, toolOptions } = this.parameterOptions;
    if (chainOptions !== null) {
      tool.function.parameters.properties.chainName.enum = chainOptions;
    } else {
      delete tool.function.parameters.properties.chainName;
    }
    if (tokenOptions !== null) {
      tool.function.parameters.properties.tokenName.enum = tokenOptions;
    } else {
      delete tool.function.parameters.properties.tokenName;
    }
    if (toolOptions !== null) {
      tool.function.parameters.properties.tool.enum = toolOptions;
    } else {
      delete tool.function.parameters.properties.tool;
    }
    this.log("[mkAskForParametersTool]:", tool);
    return tool;
  }

  // Create a tool that parses user-supplied parameters based on `parameterOptions`
  // returned from the server
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

  async processUserInput(userInput: string): Promise<ChatCompletionMessage> {
    if (!this.initialized) {
      // TODO: make .init() private
      await this.init();
    }

    this.log("[processUserInput]:", userInput);
    this.conversationHistory.push({ role: "user", content: userInput });

    // first, try to parse some data
    const parsedParametersResponse: ChatCompletionMessage =
      await this.callCompletion(
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
    const response = await this.handleParametersResponse(
      parsedParametersResponse,
    );

    if (
      !parsedParametersResponse.content ||
      response === null ||
      response == "refusal"
    ) {
      // content was not provided, we are dealing with a parameter update tool call.
      // Call the LLM once more to prompt the user to provide more info.
      const conversationalResponse: ChatCompletionMessage =
        await this.callCompletion(
          this.conversationHistory.concat([
            {
              role: "system",
              content:
                (response === "refusal"
                  ? "It's impossible to satisfy user's request, because the parameter that was provided by the user is not valid for the requested action. Apologise, tell the user his parameter is impossible to use, and then "
                  : "") +
                "use the tool schema to prompt the user to provide the parameter. list available options if possible. ",
            },
          ]),
          [this.mkAskForParametersTool()],
          // never actually call the tool
          "none",
        );
      this.log("[conversationalResponse]", conversationalResponse);
      return conversationalResponse;
    } else {
      return parsedParametersResponse;
    }
  }

  async handleParametersResponse(
    message: ChatCompletionMessage,
  ): Promise<ParameterOptions | "refusal" | null> {
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

      const {
        parameterOptions: newParameterOptions,
        payload: updatedPayload,
        refusal,
      } = await handleChatMessage(
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
      this.parameterOptions = newParameterOptions;

      if (refusal) {
        this.resetPayload();
        this.log(
          "[handleParametersResponse]: the server refused this configuration of parameters in the payload as invalid.",
        );
        return "refusal";
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

  async callCompletion(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    tool_choice: ChatCompletionToolChoiceOption = "auto",
  ): Promise<ChatCompletionMessage> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice,
    });
    return response.choices[0].message;
  }

  async init() {
    this.conversationHistory = [
      {
        role: "system",
        content: `You are a helpful assistant that provides access to blockchain lending and borrowing functionalities via Ember SDK. Never respond in markdown, always use plain text. Never add links to your response. Do not suggest the user to ask questions. When an unknown error happens, do not try to guess the error reason. Be succint. Use bullet lists to enumerate options. Never enclose token names in quotes.`,
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
