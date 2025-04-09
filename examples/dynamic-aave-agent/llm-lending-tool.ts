import util from "util";
import { OpenAI } from "openai";
import {
  ChainName,
  LLMLendingTool,
  TokenName,
} from "../../onchain-actions/build/src/services/api/dynamic/aave.js";

export class LLMLendingToolOpenAI implements LLMLendingTool {
  private openai: OpenAI;
  private MAX_ATTEMPTS: number;

  constructor(MAX_ATTEMPTS = 3) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.MAX_ATTEMPTS = MAX_ATTEMPTS;
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

  private async specifyValue(
    prompt: string,
    functionName: string,
    paramName: string,
    variants: string[],
    value: string,
  ): Promise<string | null> {
    for (let attempt = 0; attempt < this.MAX_ATTEMPTS; attempt++) {
      const result: string | null = await this.specifyValueOnce(
        prompt,
        functionName,
        paramName,
        variants,
        value,
      );
      if (result === null) {
        return null;
      }
      if (variants.includes(result)) {
        return result;
      }
      this.log("specifyValue: retrying...");
    }
    throw new Error("specifyValue: unable to decode value from LLM output");
  }

  private async specifyValueOnce(
    prompt: string,
    functionName: string,
    paramName: string,
    variants: string[],
    value: string,
  ): Promise<string | null> {
    this.log(
      `[${functionName}]: ${prompt}, (options: ${JSON.stringify(variants)})`,
    );
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant who tries to guess and normalize business logic parameters the user provides via a chat interface.
The parameters are provided in natural language, and may contain typos, extra words, and such. You are given a number of options to choose from,
and you should pick the most suitable value and provide it verbatim, or, in the case it's not clear which value corresponds to the user input, return null.
If you choose an option, you MUST provide it verbatim, as specified in the schema.

The options are:

- ${variants.join("\n- ")}`,
        },
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
            description: `Determine which ${paramName} option from the options specified in the schema corresponds the most to "${value}"`,
            parameters: {
              type: "object",
              properties: {
                [paramName]: {
                  oneOf: [
                    {
                      type: "string",
                      enum: variants,
                      description: `The ${paramName} the user wants to use, that corresponds to ${value}.`,
                    },
                    {
                      type: "null",
                      description:
                        "Not recognized. If there is no option that corresponds, return null",
                    },
                  ],
                },
              },
              required: [],
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
      if (typeof args[paramName] === "undefined") {
        this.log(`[${functionName}]: no suitable option`);
        return null;
      }
      this.log(`[${functionName}]: response: ${args[paramName]}`);
      return args[paramName];
    } catch (_e) {
      this.log(`[${functionName}]: no suitable option`);
      return null;
    }
  }

  async specifyTokenName(
    tokenName: TokenName,
    variants: TokenName[],
  ): Promise<TokenName | null> {
    return this.specifyValue(
      "The user provided the following token name: " + tokenName,
      "detect_token_name",
      "tokenName",
      variants,
      tokenName,
    );
  }

  async specifyChainName(
    chainName: ChainName,
    variants: ChainName[],
  ): Promise<ChainName | null> {
    return this.specifyValue(
      "The user provided the following chain name: " + chainName,
      "detect_chain_name",
      "chainName",
      variants,
      chainName,
    );
  }
}
