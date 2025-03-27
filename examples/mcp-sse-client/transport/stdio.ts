import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import setupServer from "./tools.js";


/**
 * Sets up an MCP server with Stdio transport.
 */
async function setupSSE(server: McpServer) {
    setupServer(server);

    let transport: StdioServerTransport;

    // Create and connect the transport
    transport = new StdioServerTransport();
    await server.connect(transport);
}


/**
 * Creates and initializes an MCP server using Stdio transport.
 */
export async function createStdioServer() {
    const server = new McpServer(
        {
            name: "MCP Stdio Chat Server",
            version: "1.0.0",
        },
        {
            capabilities: {
                resources: { tools: {} },
            },
        }
    );

    // Setup Stdio transport for communication
    setupSSE(server);
}