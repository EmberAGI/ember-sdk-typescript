import util from "util";
import { OpenAI } from "openai";
import {
  ChainName,
  LLMLendingTool,
  TokenName,
} from "../../onchain-actions/build/src/services/api/dynamic/aave.js";

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
    this.log(
      `[${functionName}]: ${prompt}, (options: ${JSON.stringify(variants)})`,
    );
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
            description: `Determine which ${paramName} the user wants to use. If there is no option that matches, do not use the tool.`,
            parameters: {
              type: "object",
              properties: {
                [paramName]: {
                  type: "string",
                  enum: variants,
                  description: `The ${paramName} the user wants to use.`,
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
