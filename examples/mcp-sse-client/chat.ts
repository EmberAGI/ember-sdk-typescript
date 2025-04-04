import { OpenAI } from "openai";
import { ChatCompletionCreateParams } from "openai/resources/index.mjs";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Define the structure for chat completion messages
 */
type ChatCompletionRequestMessage = {
    content: string;
    role: "user" | "system" | "assistant";
    function_call?: {
        name: string;
        arguments: string;
    };
};


/**
 * Define available functions for the assistant to call
 */
const functions: ChatCompletionCreateParams.Function[] = [
    {
        name: "borrow",
        description:
            "Borrow a token using Ember SDK. Provide the token name (one of the available tokens) and a human-readable amount.",
        parameters: {
            type: "object",
            properties: {
                tokenName: {
                    type: "string",
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
            "Supply (deposit) a token using Ember SDK. Provide the token name and a human-readable amount to supply.",
        parameters: {
            type: "object",
            properties: {
                tokenName: {
                    type: "string",
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
    {
        name: "getAvailableTokens",
        description:
            "Get available tokens for borrowing and lending using Ember SDK.",
        parameters: { type: "object", properties: {} },
    },
];

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

/**
 * Maintain the conversation history for context
 */
const conversationHistory: ChatCompletionRequestMessage[] = [
    {
        role: "system",
        content: `You are an assistant that provides access to blockchain lending and borrowing functionalities via Ember SDK. Never respond in markdown, always use plain text. Never add links to your response. Do not suggest the user to ask questions. When an unknown error happens, do not try to guess the error reason.`,
    },
];


/**
 * Process user input and return a response
 */
export async function processUserInput(userInput: string): Promise<ChatCompletionRequestMessage> {
    conversationHistory.push({ role: "user", content: userInput });
    const response = await callChatCompletion();
    response.content = response.content || "";
    return response as ChatCompletionRequestMessage;
}


/**
 * Function to interact with OpenAI's chat completion API
 */
async function callChatCompletion() {
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: conversationHistory,
        functions,
        function_call: "auto",
    });
    return response.choices[0].message;
}