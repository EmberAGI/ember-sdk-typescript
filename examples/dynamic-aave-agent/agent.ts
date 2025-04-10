import chalk from "chalk";
import util from "util";
import { OpenAI } from "openai";
import clone from "clone";
import {
  refinePayload,
  LendingToolPayload,
  LendingToolDataProvider,
  LLMLendingTool,
  ParameterOptions,
  LendingToolParameter,
  actionOptions,
  LendingToolAction,
} from "../../onchain-actions/build/src/services/api/dynamic/aave.js";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessage,
  ChatCompletionToolChoiceOption,
} from "openai/resources";
import readline from "readline";
import { match } from "ts-pattern";

export type SpecifyParametersCall = {
  action?: string;
  tokenName?: string;
  chainName?: string;
  amount?: string;
};

// Must be in sync with SpecifyParametersCall
const provideParametersTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "provide_parameters",
    description:
      "Read some parameters from the given user message. If there is not enough info to fill all the parameters, only fill the provided ones and YOU MUST PROCEED WITHOUT ASKING.",
    parameters: {
      type: "object",
      properties: {
        action: {
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
  action: LendingToolAction;
  tokenName: string;
  chainName: string;
  amount: string;
};

export type UpdateParameterOptions = {
  action: "updateParameterOptions";
  parameterOptions: ParameterOptions;
};

export type HandleParameterRefusal = {
  action: "handleParameterRefusal";
  refusalParameter: LendingToolParameter;
};

export type PerformDispatch = {
  action: "performDispatch";
};

export type DoNothing = {
  action: "doNothing";
};

export type ParametersResponseAction =
  | UpdateParameterOptions
  | HandleParameterRefusal
  | PerformDispatch
  | DoNothing;

export class DynamicApiAAVEAgent {
  public parameterOptions: ParameterOptions;
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
    this.parameterOptions = {
      tokenOptions: null,
      chainOptions: null,
      actionOptions: null,
    };
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
    const { parameterOptions } = await refinePayload(
      this.dataProvider,
      this.llmLendingTool,
      this.payload,
    );
    this.parameterOptions = parameterOptions;
  }

  public resetPayload() {
    this.payload = {
      action: null,
      providedTokenName: null,
      specifiedTokenName: null,
      providedChainName: null,
      specifiedChainName: null,
      amount: null,
    };
  }

  private resetPayloadParameter(param: LendingToolParameter) {
    match(param)
      .with("action", () => {
        this.payload.action = null;
      })
      .with("token name", () => {
        this.payload.providedTokenName = null;
        this.payload.specifiedTokenName = null;
      })
      .with("chain name", () => {
        this.payload.providedChainName = null;
        this.payload.specifiedChainName = null;
      })
      .with("amount", () => {
        this.payload.amount = null;
      })
      .exhaustive();
  }

  public async start() {
    await this.init();
    this.log("Agent started. Type your message below.");
    while (true) {
      await this.promptUser();
    }
  }

  public async stop() {
    this.rl.close();
  }

  async promptUser(): Promise<void> {
    return new Promise((resolve) => {
      this.rl.question("[user]: ", async (input: string) => {
        const response = await this.processUserInput(input);
        const params = Object.entries(this.payload).filter(
          ([_, value]) => value !== null,
        );
        if (params.length) {
          console.log(
            chalk.bold("[parameters]"),
            "\n",
            params
              .map(([param, value]) => chalk.yellowBright(param) + ": " + value)
              .join("\n "),
          );
        }
        console.log(chalk.bold("[assistant]"), response.content);
        resolve();
      });
    });
  }

  // Create a tool that is not callable, but cointains some context for the LLM to
  // figure out how to ask the user for more input.
  public mkAskForParametersTool(): ChatCompletionTool {
    const tool = clone(provideParametersTool);
    tool.function.description =
      "The parameters that are needed to perform an action";
    tool.function.name = "ask_for_parameters";
    const { chainOptions, tokenOptions, actionOptions } = this.parameterOptions;
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
    if (actionOptions !== null) {
      tool.function.parameters.properties.action.enum = actionOptions;
    } else {
      delete tool.function.parameters.properties.action;
    }
    this.log("[mkAskForParametersTool]:", tool);
    return tool;
  }

  // Create a tool that parses user-supplied parameters based on `parameterOptions`
  // returned from the server
  public mkProvideParametersTool(): ChatCompletionTool {
    const tool = clone(provideParametersTool);
    const mkVariants = (variants: string[], paramName: string) => ({
      oneOf: [
        {
          type: "string",
          enum: variants,
          description: `The ${paramName} the user wants to use`,
        },
        {
          type: "null",
          description:
            "Not recognized. If there is no option that corresponds to the user input, return null",
        },
      ],
    });
    const { chainOptions, tokenOptions, actionOptions } = this.parameterOptions;
    if (chainOptions !== null) {
      tool.function.parameters.properties.chainName = mkVariants(
        chainOptions,
        "chain name",
      );
    }
    if (tokenOptions !== null) {
      tool.function.parameters.properties.tokenName = mkVariants(
        tokenOptions,
        "token name",
      );
    }
    if (actionOptions !== null) {
      tool.function.parameters.properties.action = mkVariants(
        actionOptions,
        "action",
      );
    }
    this.log("[mkProvideParametersTool]:", tool);
    return tool;
  }

  async provideParameters(userInput: string): Promise<ChatCompletionMessage> {
    const response = await this.callCompletion(
      this.conversationHistory.concat([
        {
          role: "system",
          content: `You are a helpful assistant who tries to guess and normalize business logic parameters the user provides via a chat interface.
The parameters are provided in natural language, and may contain typos. You are given a number of options to choose from,
and you should pick the most suitable value and provide it verbatim, or, in the case it's not clear which value corresponds to the user input, return null.
If you choose an option, you MUST provide it verbatim, as specified in the schema.`,
        },
        {
          role: "system",
          content:
            "NEVER ask the user to provide the parameters. Only specify parameters that were provided. All of the parameters ARE optional!!! If there is not enough info to fill all the parameters, only fill them partially. You will find user input below. I will tip you $200 for a correct answer - pay attention to nullability",
        },
        { role: "user", content: userInput },
      ]),
      [this.mkProvideParametersTool()],
    );
    this.log("[provideParameters]", response);
    return response;
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
      await this.provideParameters(userInput);

    parsedParametersResponse.content = parsedParametersResponse.content || "";

    const response = await this.handleParametersResponse(
      parsedParametersResponse,
    );

    if (response.action === "performDispatch") {
      const response = await this.callCompletion(
        this.conversationHistory.concat([
          {
            role: "system",
            content:
              "Notify the user that the action has been sent for execution",
          },
        ]),
        [],
      );
      this.conversationHistory.push(response);
      return response;
    } else if (
      !parsedParametersResponse.content ||
      response.action === "doNothing" ||
      response.action == "handleParameterRefusal"
    ) {
      // content was not provided, we are dealing with a parameter update tool call.
      // Call the LLM once more to prompt the user to provide more info.
      const conversationalResponse: ChatCompletionMessage =
        await this.callCompletion(
          this.conversationHistory.concat([
            {
              role: "system",
              content: `You are a helpful assistant who tries to guess and normalize business logic parameters the user provides via a chat interface.
The parameters are provided in natural language, and may contain typos. You are given a number of options to choose from,
and you should pick the most suitable value and provide it verbatim, or, in the case it's not clear which value corresponds to the user input, return null.
If you choose an option, you MUST provide it verbatim, as specified in the schema.`,
            },
            {
              role: "system",
              content:
                (response.action === "handleParameterRefusal"
                  ? `It's impossible to satisfy user's request, because the parameter that was provided by the user (${response.refusalParameter}) is not valid for the requested action. Apologise, tell the user his parameter is impossible to use, and then `
                  : "") +
                "use the tool schema to prompt the user to provide the parameter. list available options if possible. Never ask the user to confirm an action.",
            },
          ]),
          [this.mkAskForParametersTool()],
          // never actually call the tool
          "none",
        );
      this.log("[conversationalResponse]", conversationalResponse);
      this.conversationHistory.push(conversationalResponse);
      return conversationalResponse;
    } else {
      this.conversationHistory.push(parsedParametersResponse);
      return parsedParametersResponse;
    }
  }

  async handleParametersResponse(
    message: ChatCompletionMessage,
  ): Promise<ParametersResponseAction> {
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

      if (actionOptions.includes(args.action)) {
        this.payload.action = args.action as LendingToolAction;
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
        refusalParameter,
        refusal,
      } = await refinePayload(
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
        await this.saveDispatchHistory(finalizedPayload);
        await this.dispatch(finalizedPayload);
        this.resetPayload();
        await this.resetParameterOptions();
        return { action: "performDispatch" };
      } else {
        this.log("not dispatching yet");
      }
      this.parameterOptions = newParameterOptions;

      if (refusal) {
        this.resetPayloadParameter(refusalParameter);
        this.log(
          "[handleParametersResponse]: the server refused this configuration of parameters in the payload as invalid.",
        );
        return { action: "handleParameterRefusal", refusalParameter };
      }

      return {
        action: "updateParameterOptions",
        parameterOptions: newParameterOptions,
      };
    } else {
      this.log(
        "No useful input provided from the user: provide_parameters wasn't called by LLM",
      );
      return { action: "doNothing" };
    }
  }

  public async saveDispatchHistory(
    payload: LendingToolParameters,
  ): Promise<void> {
    this.conversationHistory.push({
      role: "assistant",
      content: `Dispatching tool call with these parameters: ${JSON.stringify(payload, null, 2)}`,
    });
    this.conversationHistory.push({
      role: "assistant",
      content: "Done!",
    });
  }

  private finalizePayload(): LendingToolParameters | null {
    if (
      this.payload.amount !== null &&
      this.payload.specifiedChainName !== null &&
      this.payload.specifiedTokenName !== null &&
      this.payload.action !== null
    ) {
      return {
        amount: this.payload.amount,
        chainName: this.payload.specifiedChainName,
        tokenName: this.payload.specifiedTokenName,
        action: this.payload.action,
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

  private async init() {
    this.conversationHistory = [
      {
        role: "system",
        content: `You are a helpful assistant that provides access to blockchain lending and borrowing functionalities via Ember SDK. NEVER respond in markdown, ALWAYS use plain text. Never add links to your response. Do not suggest the user to ask questions. When an unknown error happens, do not try to guess the error reason. Be succint. Use bullet lists to enumerate options. Never enclose token names in quotes.`,
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
