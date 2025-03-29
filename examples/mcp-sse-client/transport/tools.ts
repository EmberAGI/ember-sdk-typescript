import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { processUserInput } from "../chat.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

let client: Client;
let transport: SSEClientTransport;

/**
 * Initializes the MCP client with SSE transport.
 */
client = new Client(
    { name: "SSE Client", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

/**
 * Creates an SSE transport for connecting to the MCP server.
 */
transport = new SSEClientTransport(
    new URL(process.env.SSE_SERVER_URL || "http://localhost:3001/sse"),
    {
        requestInit: {
            headers: {
                Accept: "text/event-stream",
            },
        },
    }
);

try {
    await client.connect(transport);
} catch (error) {
    const err = error as Error;
    console.error("Failed to connect to MCP server:", err.message);
}


/**
 * Sets up the MCP server with the "chat" tool.
 */
function setupServer(server: McpServer) {

    server.tool(
        "chat",
        {
            userInput: z.string(),
        },
        async ({ userInput }: { userInput: string }) => {
            try {
                // Detect intent using ChatGPT
                const intent: any = await processUserInput(userInput);

                // Call the relevant tool based on detected intent
                const response: any = await client.callTool({
                    name: intent.function_call?.name,
                    arguments: JSON.parse(intent.function_call?.arguments)
                });
                return {
                    content: [{ type: "text", text: response.content[0].text }],
                };
            } catch (error: unknown) {
                const err = error as Error;
                return {
                    content: [{ type: "text", text: `Error: ${err.message}` }],
                };
            }
        }
    );
}

export default setupServer;